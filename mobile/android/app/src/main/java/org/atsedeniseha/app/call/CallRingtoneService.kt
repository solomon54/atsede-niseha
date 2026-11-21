package org.atsedeniseha.app.call

import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.ServiceCompat

/**
 * Foreground service that keeps the incoming-call notification and ringing
 * alive in background/lock-screen states. Uses the mediaPlayback type: a call
 * ringing tone is audio playback and needs no while-in-use permission.
 */
class CallRingtoneService : Service() {
    companion object {
        const val ACTION_START = "org.atsedeniseha.app.call.START_RINGING"
        const val ACTION_STOP = "org.atsedeniseha.app.call.STOP_RINGING"
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                val payload = intent.getStringExtra(CallIntents.EXTRA_CALL_DATA) ?: ""
                if (payload.isBlank()) {
                    stopSelf()
                    return START_NOT_STICKY
                }
                try {
                    val notification = CallNotification.buildNotification(this, payload)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                        ServiceCompat.startForeground(
                            this,
                            CallIntents.NOTIFICATION_ID,
                            notification,
                            ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL or ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
                        )
                    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        ServiceCompat.startForeground(
                            this,
                            CallIntents.NOTIFICATION_ID,
                            notification,
                            ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL
                        )
                    } else {
                        startForeground(CallIntents.NOTIFICATION_ID, notification)
                    }
                    CallRingtoneController.start(this)
                } catch (_: Exception) {
                    // If the platform rejects the FGS start, keep the notification
                    // so notification actions still work; JS remains authoritative.
                    CallNotification.showNotificationOnly(this, payload)
                    stopSelf()
                }
            }
            ACTION_STOP -> stopRingingAndStop()
            else -> stopSelf()
        }
        return START_NOT_STICKY
    }

    private fun stopRingingAndStop() {
        CallRingtoneController.stop()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        CallRingtoneController.stop()
        super.onDestroy()
    }
}
