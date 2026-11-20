package org.atsedeniseha.app.call

import com.google.firebase.messaging.RemoteMessage
import expo.modules.notifications.service.ExpoFirebaseMessagingService

/**
 * Intercepts incoming-call data pushes for native ringing/presentation and
 * delegates every other message (and token rotation) to Expo's service so
 * ordinary chat/appointment notifications keep working.
 */
class CallFirebaseMessagingService : ExpoFirebaseMessagingService() {
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        val data = remoteMessage.data
        if (data["type"] == "incoming_call") {
            val payload = incomingCallJson(data)
            CallIntentsStore.saveIncoming(this, payload)
            CallBridge.emit(this, CallIntents.EVENT_INCOMING, payload)

            // Android 12+ only permits background FGS starts for high-priority
            // FCM. If the priority was downgraded, fall back to the call-style
            // notification with its own ringtone sound and actions.
            if (remoteMessage.priority == RemoteMessage.PRIORITY_HIGH) {
                CallNotification.startRinging(this, payload)
            } else {
                CallNotification.showNotificationOnly(this, payload)
            }
            return
        }
        super.onMessageReceived(remoteMessage)
    }
}
