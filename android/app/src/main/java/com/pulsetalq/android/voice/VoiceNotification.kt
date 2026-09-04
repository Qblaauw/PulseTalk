package com.pulsetalq.android.voice

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import com.pulsetalq.android.R

object VoiceNotification {
    const val ID = 2401
    private const val CHANNEL_ID = "pulsetalq_dictation"

    fun create(service: Service, message: String): Notification {
        val manager = service.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                service.getString(R.string.voice_notification_channel),
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = service.getString(R.string.voice_notification_description)
                setSound(null, null)
            },
        )
        return Notification.Builder(service, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_pulsetalq)
            .setContentTitle(service.getString(R.string.voice_notification_title))
            .setContentText(message)
            .setOngoing(true)
            .setCategory(Notification.CATEGORY_SERVICE)
            .build()
    }
}
