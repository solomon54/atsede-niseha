package org.atsedeniseha.app.call

/** Tracks the single call currently allowed to own native ringing UI. */
object CallPresentationState {
    @Volatile
    var activeCallId: String? = null
        private set

    fun matches(callId: String?): Boolean {
        val active = activeCallId ?: return true
        return callId == null || active == callId
    }

    fun setFrom(payload: String) {
        activeCallId = CallPayload.callId(payload)
    }

    fun clearIfMatches(callId: String?) {
        if (matches(callId)) activeCallId = null
    }
}
