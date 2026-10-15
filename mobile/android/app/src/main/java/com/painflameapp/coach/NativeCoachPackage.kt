package com.painflameapp.coach

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.painflameapp.platform.NativePlatformModule

/** The app's own native modules: NativeCoach (exercise session) and NativePlatform. */
class NativeCoachPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
      when (name) {
        NativeCoachModule.NAME -> NativeCoachModule(reactContext)
        NativePlatformModule.NAME -> NativePlatformModule(reactContext)
        else -> null
      }

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    listOf(NativeCoachModule.NAME, NativePlatformModule.NAME).associateWith { name ->
      ReactModuleInfo(
          name,
          name,
          false, // canOverrideExistingModule
          false, // needsEagerInit
          false, // isCxxModule
          true, // isTurboModule
      )
    }
  }
}
