package com.nemsu.studenthub;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SyncrovaUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
