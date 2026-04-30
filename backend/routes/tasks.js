const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Task = require('../models/Task');
const Group = require('../models/Group');
const router = express.Router();

const VALID_STATUSES = ['not_started', 'in_progress', 'done'];
const VALID_PRIORITIES = ['low', 'medium', 'high'];

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const findMemberGroup = async (groupId, userId) => {
  if (!isValidObjectId(groupId)) return null;
  return Group.findOne({ _id: groupId, members: userId });
};

const populateTask = async (task) => {
  await task.populate('assignedTo', 'name avatar');
  await task.populate('createdBy', 'name avatar');
  await task.populate('comments.userId', 'name avatar');
  await task.populate('activity.userId', 'name avatar');
  return task;
};

router.get('/group/:groupId', auth, async (req, res) => {
  try {
    const group = await findMemberGroup(req.params.groupId, req.user);
    if (!group) return res.status(403).json({ msg: 'You are not a member of this group' });

    const tasks = await Task.find({ groupId: req.params.groupId })
      .populate('assignedTo', 'name avatar')
      .populate('createdBy', 'name avatar')
      .populate('comments.userId', 'name avatar')
      .populate('activity.userId', 'name avatar')
      .sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { groupId, description, dueDate, priority, assignedTo } = req.body;
    const group = await findMemberGroup(groupId, req.user);
    if (!group) return res.status(403).json({ msg: 'You are not a member of this group' });
    if (!description?.trim()) return res.status(400).json({ msg: 'Task title is required' });

    const task = new Task({
      groupId,
      description: description.trim(),
      createdBy: req.user,
      dueDate: dueDate || null,
      priority: VALID_PRIORITIES.includes(priority) ? priority : 'medium',
      assignedTo: assignedTo || null,
      activity: [{ userId: req.user, action: 'created this task' }]
    });
    await task.save();
    res.status(201).json(await populateTask(task));
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.put('/:taskId', auth, async (req, res) => {
  try {
    const { status, priority, dueDate, assignedTo, comment } = req.body;
    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ msg: 'Task not found' });
    const group = await findMemberGroup(task.groupId, req.user);
    if (!group) return res.status(403).json({ msg: 'You are not a member of this group' });

    if (status && VALID_STATUSES.includes(status) && status !== task.status) {
      task.activity.push({ userId: req.user, action: `changed status to ${status}` });
      task.status = status;
    }
    if (priority && VALID_PRIORITIES.includes(priority) && priority !== task.priority) {
      task.activity.push({ userId: req.user, action: `changed priority to ${priority}` });
      task.priority = priority;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'dueDate')) {
      const nextDueDate = dueDate || null;
      task.dueDate = nextDueDate;
      task.activity.push({ userId: req.user, action: nextDueDate ? 'updated the due date' : 'cleared the due date' });
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'assignedTo')) {
      task.assignedTo = assignedTo || null;
      task.activity.push({ userId: req.user, action: assignedTo ? 'updated the assignee' : 'cleared the assignee' });
    }
    if (typeof comment === 'string' && comment.trim()) {
      const trimmedComment = comment.trim();
      task.comments.push({ userId: req.user, text: trimmedComment });
      task.activity.push({ userId: req.user, action: `commented: "${trimmedComment}"` });
    }
    await task.save();
    res.json(await populateTask(task));
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.put('/:taskId/complete', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ msg: 'Task not found' });
    const group = await findMemberGroup(task.groupId, req.user);
    if (!group) return res.status(403).json({ msg: 'You are not a member of this group' });

    task.status = task.status === 'done' ? 'not_started' : 'done';
    task.activity.push({ userId: req.user, action: `changed status to ${task.status}` });
    await task.save();
    res.json(await populateTask(task));
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.delete('/:taskId', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ msg: 'Task not found' });

    const group = await findMemberGroup(task.groupId, req.user);
    if (!group) return res.status(403).json({ msg: 'You are not a member of this group' });
    if (!task.createdBy || task.createdBy.toString() !== req.user) {
      return res.status(403).json({ msg: 'Only the task creator can delete this task' });
    }

    await task.deleteOne();
    res.json({ msg: 'Task deleted', taskId: req.params.taskId });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

module.exports = router;
