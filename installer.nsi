Unicode true
!define APPNAME "Redline Pro"
!define APPEXE "Redline Pro.exe"
!define VERSION "1.0.0"
!define PUBLISHER "Redline Studio"
!define UNINSTKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\RedlinePro"

!ifndef SRC
  !define SRC "dist\win-unpacked"
!endif
!ifndef ICON
  !define ICON "build\icon.ico"
!endif
!ifndef LIC
  !define LIC "LICENSE.txt"
!endif
!ifndef OUT
  !define OUT "dist\RedlinePro-Setup-1.0.0.exe"
!endif

!include "MUI2.nsh"

Name "${APPNAME}"
OutFile "${OUT}"
InstallDir "$LOCALAPPDATA\Programs\${APPNAME}"
InstallDirRegKey HKCU "Software\${APPNAME}" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
BrandingText "Redline Studio - textportdocx.in"

!define MUI_ICON "${ICON}"
!define MUI_UNICON "${ICON}"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Welcome to Redline Pro ${VERSION}"
!define MUI_WELCOMEPAGE_TEXT "This installs Redline Pro ${VERSION} (Enterprise Engineering Review & Compare Studio).$\r$\n$\r$\nRedline Studio - textportdocx.in.$\r$\n100% Free & Offline for personal and commercial engineering use.$\r$\n$\r$\nNo administrator rights are needed. Click Next to continue."
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APPEXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Start Redline Pro now"
!insertmacro MUI_PAGE_WELCOME
!define MUI_LICENSEPAGE_TEXT_TOP "Please read the License Agreement. Press Page Down to see the rest."
!define MUI_LICENSEPAGE_RADIOBUTTONS
!define MUI_LICENSEPAGE_RADIOBUTTONS_TEXT_ACCEPT "I accept the terms of the License Agreement"
!define MUI_LICENSEPAGE_RADIOBUTTONS_TEXT_DECLINE "I do not accept"
!insertmacro MUI_PAGE_LICENSE "${LIC}"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

VIProductVersion "1.0.0.0"
VIAddVersionKey "ProductName" "${APPNAME} Setup"
VIAddVersionKey "CompanyName" "${PUBLISHER}"
VIAddVersionKey "LegalCopyright" "Redline Studio - textportdocx.in"
VIAddVersionKey "FileDescription" "${APPNAME} ${VERSION} Installer"
VIAddVersionKey "FileVersion" "${VERSION}"

Section "Install"
  SetOutPath "$INSTDIR"
  File /r "${SRC}\*.*"
  File "/oname=app.ico" "${ICON}"
  File "/oname=LICENSE.txt" "${LIC}"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateDirectory "$SMPROGRAMS\${APPNAME}"
  CreateShortcut "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk" "$INSTDIR\${APPEXE}" "" "$INSTDIR\app.ico"
  CreateShortcut "$SMPROGRAMS\${APPNAME}\Uninstall ${APPNAME}.lnk" "$INSTDIR\Uninstall.exe"
  CreateShortcut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\${APPEXE}" "" "$INSTDIR\app.ico"
  WriteRegStr HKCU "Software\${APPNAME}" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayName" "${APPNAME}"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINSTKEY}" "Publisher" "${PUBLISHER}"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayIcon" "$INSTDIR\app.ico"
  WriteRegStr HKCU "${UNINSTKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTKEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKCU "${UNINSTKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTKEY}" "NoRepair" 1
  WriteRegDWORD HKCU "${UNINSTKEY}" "EstimatedSize" 285000
  WriteRegStr HKCU "${UNINSTKEY}" "URLInfoAbout" "https://redline.textportdocx.in"
  WriteRegStr HKCU "${UNINSTKEY}" "HelpLink" "https://redline.textportdocx.in"
  WriteRegStr HKCU "${UNINSTKEY}" "URLUpdateInfo" "https://redline.textportdocx.in"
  ; appear in the "Open with" list for PDF, DXF, Gerber, and Redline session files
  WriteRegStr HKCU "Software\Classes\Applications\${APPEXE}" "FriendlyAppName" "${APPNAME}"
  WriteRegStr HKCU "Software\Classes\Applications\${APPEXE}\shell\open\command" "" '"$INSTDIR\${APPEXE}" "%1"'
  WriteRegStr HKCU "Software\Classes\Applications\${APPEXE}\SupportedTypes" ".pdf" ""
  WriteRegStr HKCU "Software\Classes\Applications\${APPEXE}\SupportedTypes" ".dxf" ""
  WriteRegStr HKCU "Software\Classes\Applications\${APPEXE}\SupportedTypes" ".gbr" ""
  WriteRegStr HKCU "Software\Classes\Applications\${APPEXE}\SupportedTypes" ".redline" ""
  WriteRegStr HKCU "Software\Classes\.pdf\OpenWithList\${APPEXE}" "" ""
  WriteRegStr HKCU "Software\Classes\.dxf\OpenWithList\${APPEXE}" "" ""
  WriteRegStr HKCU "Software\Classes\.gbr\OpenWithList\${APPEXE}" "" ""
  WriteRegStr HKCU "Software\Classes\.redline\OpenWithList\${APPEXE}" "" ""
  ; Explorer right-click on any PDF: "Edit with Redline Pro" and "Compare with Redline Pro" (select 2 PDFs)
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.pdf\shell\RedlineEdit" "" "Edit with Redline Pro"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.pdf\shell\RedlineEdit" "Icon" "$INSTDIR\app.ico"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.pdf\shell\RedlineEdit\command" "" '"$INSTDIR\${APPEXE}" "%1"'
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.pdf\shell\RedlineCompare" "" "Compare with Redline Pro"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.pdf\shell\RedlineCompare" "Icon" "$INSTDIR\app.ico"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.pdf\shell\RedlineCompare\command" "" '"$INSTDIR\${APPEXE}" --compare "%1"'
  ; Explorer right-click on .dxf: "Inspect CAD with Redline Pro"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.dxf\shell\RedlineInspectCAD" "" "Inspect CAD with Redline Pro"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.dxf\shell\RedlineInspectCAD" "Icon" "$INSTDIR\app.ico"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.dxf\shell\RedlineInspectCAD\command" "" '"$INSTDIR\${APPEXE}" "%1"'
  ; Explorer right-click on .gbr: "Inspect Gerber with Redline Pro"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.gbr\shell\RedlineInspectGerber" "" "Inspect Gerber with Redline Pro"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.gbr\shell\RedlineInspectGerber" "Icon" "$INSTDIR\app.ico"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.gbr\shell\RedlineInspectGerber\command" "" '"$INSTDIR\${APPEXE}" "%1"'
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\${APPNAME}.lnk"
  RMDir /r "$SMPROGRAMS\${APPNAME}"
  DeleteRegKey HKCU "${UNINSTKEY}"
  DeleteRegKey HKCU "Software\${APPNAME}"
  DeleteRegKey HKCU "Software\Classes\Applications\${APPEXE}"
  DeleteRegKey HKCU "Software\Classes\.pdf\OpenWithList\${APPEXE}"
  DeleteRegKey HKCU "Software\Classes\.dxf\OpenWithList\${APPEXE}"
  DeleteRegKey HKCU "Software\Classes\.gbr\OpenWithList\${APPEXE}"
  DeleteRegKey HKCU "Software\Classes\.redline\OpenWithList\${APPEXE}"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.pdf\shell\RedlineEdit"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.pdf\shell\RedlineCompare"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.dxf\shell\RedlineInspectCAD"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.gbr\shell\RedlineInspectGerber"
  RMDir /r "$INSTDIR"
SectionEnd
