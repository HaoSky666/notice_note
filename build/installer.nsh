!include "nsProcess.nsh"

!macro ClearBrokenLegacyUninstallEntry ROOT_KEY
  ClearErrors
  DeleteRegKey ${ROOT_KEY} "${UNINSTALL_REGISTRY_KEY}"
  !ifdef UNINSTALL_REGISTRY_KEY_2
    ClearErrors
    DeleteRegKey ${ROOT_KEY} "${UNINSTALL_REGISTRY_KEY_2}"
  !endif
!macroend

!macro customInit
  !insertmacro ClearBrokenLegacyUninstallEntry SHELL_CONTEXT
  !insertmacro ClearBrokenLegacyUninstallEntry HKEY_CURRENT_USER
!macroend

!macro StrictFindAppProcess _FILE _RETURN
  !ifdef INSTALL_MODE_PER_ALL_USERS
    ${nsProcess::FindProcess} "${_FILE}" ${_RETURN}
  !else
    nsExec::Exec `"$CmdPath" /C tasklist /FI "USERNAME eq %USERNAME%" /FI "IMAGENAME eq ${_FILE}" /FO CSV | "$FindPath" "${_FILE}"`
    Pop ${_RETURN}
  !endif
!macroend

!macro StrictKillAppProcess _FILE _FORCE
  Push $0
  ${if} ${_FORCE} == 1
    StrCpy $0 "/F"
  ${else}
    StrCpy $0 ""
  ${endIf}

  !ifdef INSTALL_MODE_PER_ALL_USERS
    nsExec::Exec `taskkill $0 /IM "${_FILE}"`
  !else
    nsExec::Exec `"$CmdPath" /C taskkill $0 /IM "${_FILE}" /FI "USERNAME eq %USERNAME%"`
  !endif
  Pop $0
!macroend

!macro customCheckAppRunning
  !insertmacro StrictFindAppProcess "${APP_EXECUTABLE_FILENAME}" $R0
  ${if} $R0 == 0
    ${ifNot} ${isUpdated}
      MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "$(appRunning)" /SD IDOK IDOK doStopProcess
      Quit
    ${endif}

    doStopProcess:
      DetailPrint "$(appClosing)"
      !insertmacro StrictKillAppProcess "${APP_EXECUTABLE_FILENAME}" 0
      Sleep 300

      StrCpy $R1 0
      loop:
        IntOp $R1 $R1 + 1
        !insertmacro StrictFindAppProcess "${APP_EXECUTABLE_FILENAME}" $R0
        ${if} $R0 == 0
          Sleep 1000
          !insertmacro StrictKillAppProcess "${APP_EXECUTABLE_FILENAME}" 1
          !insertmacro StrictFindAppProcess "${APP_EXECUTABLE_FILENAME}" $R0
          ${if} $R0 == 0
            DetailPrint `Waiting for "${PRODUCT_NAME}" to close.`
            Sleep 2000
          ${else}
            Goto not_running
          ${endIf}
        ${else}
          Goto not_running
        ${endIf}

        ${if} $R1 > 1
          MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY loop
          Quit
        ${else}
          Goto loop
        ${endIf}

      not_running:
  ${endIf}
!macroend
