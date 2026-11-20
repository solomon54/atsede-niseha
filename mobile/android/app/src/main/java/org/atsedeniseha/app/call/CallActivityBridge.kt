package org.atsedeniseha.app.call

import android.content.Context
import android.content.Intent

/**
 * MainActivity forwards call intents here. The action was already emitted by
 * CallActions; we only persist it so a not-yet-mounted JS bridge can consume it
 * and clear the extras to avoid replaying on configuration changes.
 */
object CallActivityBridge {
    fun forward(context: Context, intent: Intent) {
        val action = intent.getStringExtra(CallIntents.EXTRA_ACTION) ?: return
        val payload = intent.getStringExtra(CallIntents.EXTRA_CALL_DATA) ?: return
        if (action.isBlank() || payload.isBlank()) return

        CallIntentsStore.saveAction(context, action, payload)
        intent.removeExtra(CallIntents.EXTRA_ACTION)
        intent.removeExtra(CallIntents.EXTRA_CALL_DATA)
    }
}
