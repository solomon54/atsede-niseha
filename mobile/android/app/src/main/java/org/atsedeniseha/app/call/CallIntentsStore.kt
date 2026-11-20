package org.atsedeniseha.app.call

import android.content.Context
import android.content.SharedPreferences

/**
 * Persists the last native call action/incoming payload so a cold-started JS
 * bridge can consume it. DeviceEventEmitter events are only delivered when the
 * React context is already alive.
 *
 * All mutations are call-ID-aware: cleanup for an old call never removes a
 * newer call's pending presentation.
 */
object CallIntentsStore {
    internal const val PREFS_NAME = "atsede_call_intents"
    private const val KEY_ACTION = "pending_action"
    private const val KEY_PAYLOAD = "pending_payload"
    private const val KEY_INCOMING = "pending_incoming"
    private const val KEY_TERMINAL_IDS = "terminal_call_ids"
    private const val MAX_TERMINAL_IDS = 32

    private fun prefs(context: Context): SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    internal fun saveIncoming(prefs: SharedPreferences, payload: String) {
        if (payload.isBlank()) return
        if (CallPayload.callId(payload) != null && isTerminal(prefs, payload)) return
        prefs.edit().putString(KEY_INCOMING, payload).apply()
    }

    fun saveIncoming(context: Context, payload: String) =
        saveIncoming(prefs(context), payload)

    internal fun saveAction(prefs: SharedPreferences, action: String, payload: String) {
        if (action.isBlank() || payload.isBlank()) return
        prefs.edit()
            .putString(KEY_ACTION, action)
            .putString(KEY_PAYLOAD, payload)
            .apply()
    }

    fun saveAction(context: Context, action: String, payload: String) =
        saveAction(prefs(context), action, payload)

    internal fun peek(prefs: SharedPreferences): Pair<String, String>? {
        val action = prefs.getString(KEY_ACTION, null) ?: return null
        val payload = prefs.getString(KEY_PAYLOAD, "") ?: ""
        if (action.isBlank() || payload.isBlank()) return null
        return action to payload
    }

    fun peek(context: Context): Pair<String, String>? = peek(prefs(context))

    internal fun peekIncoming(prefs: SharedPreferences): String? =
        prefs.getString(KEY_INCOMING, null)?.takeIf { it.isNotBlank() }

    fun peekIncoming(context: Context): String? = peekIncoming(prefs(context))

    /** Legacy one-shot consumer; action state is removed, incoming is preserved. */
    internal fun consumeAction(prefs: SharedPreferences): Pair<String, String>? {
        val result = peek(prefs) ?: return null
        prefs.edit()
            .remove(KEY_ACTION)
            .remove(KEY_PAYLOAD)
            .apply()
        return result
    }

    fun consumeAction(context: Context): Pair<String, String>? = consumeAction(prefs(context))

    internal fun consumeIncoming(prefs: SharedPreferences): String? {
        val payload = peekIncoming(prefs) ?: return null
        prefs.edit().remove(KEY_INCOMING).apply()
        return payload
    }

    fun consumeIncoming(context: Context): String? = consumeIncoming(prefs(context))

    fun consume(context: Context): Pair<String, String>? {
        val localPrefs = prefs(context)
        val action = consumeAction(localPrefs)
        if (action != null) return action
        val incoming = consumeIncoming(localPrefs)
        return incoming?.let { CallIntents.ACTION_INCOMING to it }
    }

    /** Removes only entries whose callId (or exact payload) matches. */
    internal fun clearMatching(prefs: SharedPreferences, payload: String) {
        if (payload.isBlank()) return
        val incoming = prefs.getString(KEY_INCOMING, null)
        val actionPayload = prefs.getString(KEY_PAYLOAD, null)
        val editor = prefs.edit()
        var changed = false

        if (matchesTarget(incoming, payload)) {
            editor.remove(KEY_INCOMING)
            changed = true
        }
        if (matchesTarget(actionPayload, payload)) {
            editor.remove(KEY_ACTION)
            editor.remove(KEY_PAYLOAD)
            changed = true
        }
        if (changed) editor.apply()
    }

    fun clearMatching(context: Context, payload: String) =
        clearMatching(prefs(context), payload)

    internal fun markTerminal(prefs: SharedPreferences, payload: String) {
        val callId = CallPayload.callId(payload) ?: return
        val ids = (prefs.getStringSet(KEY_TERMINAL_IDS, null) ?: emptySet()).toMutableSet()
        ids.add(callId)
        while (ids.size > MAX_TERMINAL_IDS) {
            ids.remove(ids.first())
        }
        prefs.edit().putStringSet(KEY_TERMINAL_IDS, ids).apply()
    }

    fun markTerminal(context: Context, payload: String) =
        markTerminal(prefs(context), payload)

    internal fun isTerminal(prefs: SharedPreferences, payload: String): Boolean {
        val callId = CallPayload.callId(payload) ?: return false
        return (prefs.getStringSet(KEY_TERMINAL_IDS, null) ?: emptySet()).contains(callId)
    }

    fun isTerminal(context: Context, payload: String): Boolean =
        isTerminal(prefs(context), payload)

    /** A fresh authoritative ringing status wins over a stale local tombstone. */
    internal fun unmarkTerminal(prefs: SharedPreferences, payload: String) {
        val callId = CallPayload.callId(payload) ?: return
        val ids = (prefs.getStringSet(KEY_TERMINAL_IDS, null) ?: emptySet()).toMutableSet()
        if (ids.remove(callId)) {
            prefs.edit().putStringSet(KEY_TERMINAL_IDS, ids).apply()
        }
    }

    fun unmarkTerminal(context: Context, payload: String) =
        unmarkTerminal(prefs(context), payload)

    private fun matchesTarget(current: String?, target: String): Boolean {
        if (current.isNullOrBlank()) return false
        if (CallPayload.matches(current, target)) return true
        return current == target
    }
}
