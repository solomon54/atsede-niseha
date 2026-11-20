package org.atsedeniseha.app.call

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import org.atsedeniseha.app.R

/** Owns the continuous incoming-call ringtone. */
object CallRingtoneController {
    private val lock = Any()
    private var player: MediaPlayer? = null

    fun start(context: Context) {
        synchronized(lock) {
            if (player?.isPlaying == true) return
            releaseLocked()
            try {
                val mediaPlayer = MediaPlayer.create(context.applicationContext, R.raw.call_ring)
                    ?: return
                mediaPlayer.setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                mediaPlayer.isLooping = true
                mediaPlayer.setVolume(1f, 1f)
                mediaPlayer.start()
                player = mediaPlayer
            } catch (_: Exception) {
                releaseLocked()
            }
        }
    }

    fun stop() {
        synchronized(lock) {
            releaseLocked()
        }
    }

    fun setSpeaker(context: Context, enabled: Boolean) {
        try {
            val audioManager =
                context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
            @Suppress("DEPRECATION")
            audioManager.isSpeakerphoneOn = enabled
        } catch (_: Exception) {
        }
    }

    private fun releaseLocked() {
        player?.let { mediaPlayer ->
            try {
                if (mediaPlayer.isPlaying) mediaPlayer.stop()
            } catch (_: Exception) {
            }
            try {
                mediaPlayer.release()
            } catch (_: Exception) {
            }
        }
        player = null
    }
}
