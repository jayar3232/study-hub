const express = require('express');
const auth = require('../middleware/auth');
const Task = require('../models/Task');
const router = express.Router();

router.get('/group/:groupId', auth, async (req, res) => {
  try {
    const tasks = await Task.find({ groupId: req.params.groupId })
      .populate('assignedTo', 'name avatar')
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
    const task = new Task({ groupId, description, dueDate, priority, assignedTo });
    await task.save();
    await task.populate('assignedTo', 'name avatar');
    res.json(task);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.put('/:taskId', auth, async (req, res) => {
  try {
    const { status, priority, dueDate, assignedTo, comment } = req.body;
    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ msg: 'Task not found' });
    if (status && status !== task.status) {
      task.activity.push({ userId: req.user, action: `changed status to ${status}` });
      task.status = status;
    }
    if (priority) task.priority = priority;
    if (dueDate) task.dueDate = dueDate;
    if (assignedTo !== undefined) task.assignedTo = assignedTo;
    if (comment) {
      task.comments.push({ userId: req.user, text: comment });
      task.activity.push({ userId: req.user, action: `commented: "${comment}"` });
    }
    await task.save();
    await task.populate('assignedTo', 'name avatar');
    await task.populate('comments.userId', 'name avatar');
    await task.populate('activity.userId', 'name avatar');
    res.json(task);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.put('/:taskId/complete', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ msg: 'Task not found' });
    task.status = task.status === 'done' ? 'not_started' : 'done';
    await task.save();
    res.json(task);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

module.exports = router;