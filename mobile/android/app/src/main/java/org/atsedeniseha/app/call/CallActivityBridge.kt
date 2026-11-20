package org.atsedeniseha.app.call

import android.content.Context
import android.content.Intent

/**
 * MainActivity forwards call intents here. Actions were already emitted by
 * CallActions; incoming hints from FCM cold starts are persisted and emitted so
 * JS can validate them before any UI is presented.
 */
object CallActivityBridge {
    fun forward(context: Context, intent: Intent) {
        val action = intent.getStringExtra(CallIntents.EXTRA_ACTION)
        val payload = intent.getStringExtra(CallIntents.EXTRA_CALL_DATA)
        if (!action.isNullOrBlank() && !payload.isNullOrBlank()) {
            CallIntentsStore.saveAction(context, action, payload)
            intent.removeExtra(CallIntents.EXTRA_ACTION)
            intent.removeExtra(CallIntents.EXTRA_CALL_DATA)
        }

        val hint = intent.getStringExtra(CallIntents.EXTRA_INCOMING_HINT)
        if (!hint.isNullOrBlank()) {
            if (CallIntentsStore.isTerminal(context, hint)) {
                CallNotification.cleanupCall(context, hint, false)
            } else {
                CallIntentsStore.saveIncoming(context, hint)
                CallBridge.emit(context, CallIntents.EVENT_INCOMING, hint)
            }
            intent.removeExtra(CallIntents.EXTRA_INCOMING_HINT)
        }
    }
}
