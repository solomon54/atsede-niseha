package org.atsedeniseha.app.call

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import org.json.JSONObject

/** JS bridge: native owns ringing/presentation, JS owns state transitions. */
class CallNotificationModule(private val appContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(appContext) {

    override fun getName(): String = "CallNotificationModule"

    private fun JSONObject.toStringMap(): Map<String, String> {
        val map = mutableMapOf<String, String>()
        keys().forEach { key -> map[key] = optString(key, "") }
        return map
    }

    /** Called only after JS has validated the call with /api/livekit/status. */
    @ReactMethod
    fun showIncomingCall(json: String) {
        if (json.isBlank()) return
        val data = runCatching { JSONObject(json) }.getOrDefault(JSONObject())
        val payload = incomingCallJson(data.toStringMap())
        CallIntentsStore.unmarkTerminal(appContext, payload)
        CallIntentsStore.saveIncoming(appContext, payload)
        CallNotification.startRinging(appContext, payload)
    }

    /** Legacy global stop; JS uses cleanupCall for call-ID-aware cleanup. */
    @ReactMethod
    fun stopRinging() {
        CallNotification.stopRinging(appContext)
    }

    @ReactMethod
    fun cleanupCall(json: String, terminal: Boolean) {
        CallNotification.cleanupCall(appContext, json, terminal)
    }

    @ReactMethod
    fun clearPendingCallIntent(json: String) {
        if (json.isNotBlank()) CallIntentsStore.clearMatching(appContext, json)
    }

    @ReactMethod
    fun setSpeaker(enabled: Boolean) {
        CallRingtoneController.setSpeaker(appContext, enabled)
    }

    /** Reads persisted state without consuming it. */
    @ReactMethod
    fun peekInitialCallIntent(promise: Promise) {
        promise.resolve(intentMap(CallIntentsStore.peek(appContext), CallIntentsStore.peekIncoming(appContext)))
    }

    /** Legacy consume path kept for compatibility with older JS bundles. */
    @ReactMethod
    fun consumeInitialCallIntent(promise: Promise) {
        val action = CallIntentsStore.consumeAction(appContext)
        val incoming = if (action == null) CallIntentsStore.consumeIncoming(appContext) else null
        promise.resolve(intentMap(action, incoming))
    }

    private fun intentMap(action: Pair<String, String>?, incoming: String?): WritableMap {
        val result: WritableMap = Arguments.createMap()
        if (action != null) {
            result.putString("action", action.first)
            result.putString("payload", action.second)
        } else if (incoming != null) {
            result.putString("action", CallIntents.ACTION_INCOMING)
            result.putString("payload", incoming)
        }
        return result
    }
}
