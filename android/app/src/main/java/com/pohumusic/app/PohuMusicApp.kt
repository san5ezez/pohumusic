package com.pohumusic.app

import android.app.Application
import android.content.Context
import com.pohumusic.app.player.PlaybackManager

class PohuMusicApp : Application() {
    lateinit var playbackManager: PlaybackManager
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this
        playbackManager = PlaybackManager(this)
    }

    companion object {
        lateinit var instance: PohuMusicApp
            private set
    }
}
