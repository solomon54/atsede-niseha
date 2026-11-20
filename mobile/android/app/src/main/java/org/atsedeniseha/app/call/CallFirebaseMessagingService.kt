package org.atsedeniseha.app.call

import com.google.firebase.messaging.RemoteMessage
import expo.modules.notifications.service.ExpoFirebaseMessagingService

/**
 * Intercepts incoming-call data pushes for native call handling and delegates
 * every other message (and token rotation) to Expo's service so ordinary
 * chat/appointment notifications keep working.
 *
 * An incoming-call push is only staged here. Ringing/presentation starts after
 * JS validates the call against the authenticated backend status endpoint.
 */
class CallFirebaseMessagingService : ExpoFirebaseMessagingService() {
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        val data = remoteMessage.data
        if (data["type"] == "incoming_call") {
            val payload = incomingCallJson(data)
            CallIntentsStore.saveIncoming(this, payload)

            if (CallBridge.currentReactContext(this) != null) {
                CallBridge.emit(this, CallIntents.EVENT_INCOMING, payload)
            } else {
                // Cold start: bring up the JS runtime, which will consume the
                // persisted hint and validate it before presenting anything.
                CallBootstrap.wake(this, payload)
            }
            return
        }
        super.onMessageReceived(remoteMessage)
    }
}
