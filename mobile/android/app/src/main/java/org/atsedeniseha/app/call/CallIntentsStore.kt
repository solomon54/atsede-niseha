package org.atsedeniseha.app.call

import android.content.Context

/**
 * Persists the last native call action/incoming payload so a cold-started JS
 * bridge can consume it. DeviceEventEmitter events are only delivered when the
 * React context is already alive.
 */
object CallIntentsStore {
    private const val PREFS_NAME = "atsede_call_intents"
    private const val KEY_ACTION = "pending_action"
    private const val KEY_PAYLOAD = "pending_payload"
    private const val KEY_INCOMING = "pending_incoming"

    private fun prefs(context: Context) =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun saveIncoming(context: Context, payload: String) {
        if (payload.isBlank()) return
        prefs(context).edit().putString(KEY_INCOMING, payload).apply()
    }

    fun saveAction(context: Context, action: String, payload: String) {
        if (action.isBlank() || payload.isBlank()) return
        prefs(context).edit()
            .putString(KEY_ACTION, action)
            .putString(KEY_PAYLOAD, payload)
            .apply()
    }

    fun consume(context: Context): Pair<String, String>? {
        val prefs = prefs(context)
        val action = prefs.getString(KEY_ACTION, null) ?: return null
        val payload = prefs.getString(KEY_PAYLOAD, "") ?: ""
        prefs.edit()
            .remove(KEY_ACTION)
            .remove(KEY_PAYLOAD)
            .remove(KEY_INCOMING)
            .apply()
        return action to payload
    }

    fun consumeIncoming(context: Context): String? {
        val prefs = prefs(context)
        val payload = prefs.getString(KEY_INCOMING, null) ?: return null
        prefs.edit().remove(KEY_INCOMING).apply()
        return payload
    }
}
