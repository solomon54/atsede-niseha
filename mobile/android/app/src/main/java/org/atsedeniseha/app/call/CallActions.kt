package org.atsedeniseha.app.call

import android.content.Context
import android.content.Intent
import org.atsedeniseha.app.MainActivity

/** Shared action path used by the notification receiver, lock-screen UI and app. */
object CallActions {
    fun perform(context: Context, action: String, payload: String) {
        if (payload.isBlank()) return

        CallNotification.stopRinging(context)
        CallIntentsStore.saveAction(context, action, payload)
        CallBridge.emit(context, CallBridge.eventFor(action), payload)

        // Bring the app up so JS can perform the authoritative API transition
        // even when the action came from a cold start or the lock screen.
        val launch = Intent(context, MainActivity::class.java)
            .putExtra(CallIntents.EXTRA_ACTION, action)
            .putExtra(CallIntents.EXTRA_CALL_DATA, payload)
            .addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP or
                    Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED
            )
        try {
            context.startActivity(launch)
        } catch (_: Exception) {
        }
    }
}
