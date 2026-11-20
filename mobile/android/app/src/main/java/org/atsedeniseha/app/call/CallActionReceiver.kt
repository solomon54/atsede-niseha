package org.atsedeniseha.app.call

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class CallActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != CallIntents.ACTION_BROADCAST) return
        val action = intent.getStringExtra(CallIntents.EXTRA_ACTION) ?: return
        val payload = intent.getStringExtra(CallIntents.EXTRA_CALL_DATA) ?: return
        CallActions.perform(context, action, payload)
    }
}
