package org.atsedeniseha.app.call

import android.content.Context
import android.content.Intent
import org.atsedeniseha.app.MainActivity

/** Wakes the JS runtime so it can validate a staged incoming-call hint. */
object CallBootstrap {
    fun wake(context: Context, payload: String) {
        if (payload.isBlank()) return
        val intent = Intent(context, MainActivity::class.java)
            .putExtra(CallIntents.EXTRA_INCOMING_HINT, payload)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        try {
            context.startActivity(intent)
        } catch (_: Exception) {
            // Persisted payload remains available for the next app open.
        }
    }
}
