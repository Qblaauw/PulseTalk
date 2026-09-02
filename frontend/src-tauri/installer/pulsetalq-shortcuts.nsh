; Keep Windows application shortcuts on the separately named Pulse icon resource.
Var PulseTalqShortcutRefreshReady

!macro PULSETALQ_SET_SHORTCUT_ICON shortcut icon
  !insertmacro ComHlpr_CreateInProcInstance ${CLSID_ShellLink} ${IID_IShellLink} r0 ""
  ${If} $0 P<> 0
    ${IUnknown::QueryInterface} $0 '("${IID_IPersistFile}",.r1)'
    ${If} $1 P<> 0
      ${IPersistFile::Load} $1 '("${shortcut}", ${STGM_READWRITE})'
      ${IShellLink::SetIconLocation} $0 '(w "${icon}", i 0)'
      ${IPersistFile::Save} $1 '("${shortcut}",1)'
      ${IUnknown::Release} $1 ""
    ${EndIf}
    ${IUnknown::Release} $0 ""
  ${EndIf}
!macroend

; Tauri creates a desktop shortcut from its Finish-page callback, after the
; post-install hook. Refresh it once the page callback has run.
Function .onGUIEnd
  ${If} $PulseTalqShortcutRefreshReady = 1
  ${AndIf} ${FileExists} "$DESKTOP\PulseTalq.lnk"
    !insertmacro PULSETALQ_SET_SHORTCUT_ICON "$DESKTOP\PulseTalq.lnk" "$INSTDIR\pulsetalq-shortcut.ico"
  ${EndIf}
FunctionEnd

!macro NSIS_HOOK_POSTINSTALL
  ; Remove only the transitional PulseTalk shortcut that points at its old binary.
  ; Meetily shortcuts and every other PulseTalk target stay untouched.
  !insertmacro IsShortcutTarget "$SMPROGRAMS\PulseTalk.lnk" "$LOCALAPPDATA\PulseTalk\meetily.exe"
  Pop $R0
  ${If} $R0 = 1
    Delete "$SMPROGRAMS\PulseTalk.lnk"
  ${EndIf}

  !insertmacro IsShortcutTarget "$DESKTOP\PulseTalk.lnk" "$LOCALAPPDATA\PulseTalk\meetily.exe"
  Pop $R0
  ${If} $R0 = 1
    Delete "$DESKTOP\PulseTalk.lnk"
  ${EndIf}

  ; Fresh /NS installs keep Tauri's no-shortcut behavior. Updates still repair
  ; their canonical shortcut and any existing desktop shortcut.
  ${If} $UpdateMode = 1
  ${OrIf} $NoShortcutMode <> 1
    Delete "$SMPROGRAMS\${PRODUCTNAME}.lnk"
    CreateShortcut "$SMPROGRAMS\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe" "" "$INSTDIR\pulsetalq-shortcut.ico" 0 SW_SHOWNORMAL "" "${PRODUCTNAME}"
    !insertmacro SetLnkAppUserModelId "$SMPROGRAMS\${PRODUCTNAME}.lnk"
    ${If} ${FileExists} "$DESKTOP\${PRODUCTNAME}.lnk"
      Delete "$DESKTOP\${PRODUCTNAME}.lnk"
      CreateShortcut "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe" "" "$INSTDIR\pulsetalq-shortcut.ico" 0 SW_SHOWNORMAL "" "${PRODUCTNAME}"
      !insertmacro SetLnkAppUserModelId "$DESKTOP\${PRODUCTNAME}.lnk"
    ${EndIf}
    StrCpy $PulseTalqShortcutRefreshReady 1
  ${EndIf}
!macroend
