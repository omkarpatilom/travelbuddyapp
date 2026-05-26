@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Detecting Active WiFi Network IP...
echo ========================================

set IP=
set WIFI_FOUND=0

REM Read ipconfig output line by line
for /f "delims=" %%L in ('ipconfig') do (

    REM Detect active WiFi adapter section
    echo %%L | findstr /C:"Wireless LAN adapter Wi-Fi" >nul
    if not errorlevel 1 (
        set WIFI_FOUND=1
    )

    REM Stop when another adapter starts
    echo %%L | findstr /R /C:"adapter .*:" >nul
    if not errorlevel 1 (
        echo %%L | findstr /C:"Wireless LAN adapter Wi-Fi" >nul
        if errorlevel 1 (
            if !WIFI_FOUND! EQU 1 (
                goto :done
            )
        )
    )

    REM Extract IPv4 only from active WiFi section
    if !WIFI_FOUND! EQU 1 (
        echo %%L | findstr /C:"IPv4 Address" >nul
        if not errorlevel 1 (

            for /f "tokens=2 delims=:" %%A in ("%%L") do (
                set IP=%%A
                set IP=!IP: =!
                goto :done
            )
        )
    )
)

:done

if "%IP%"=="" (
    echo ERROR: Could not detect active WiFi IPv4 address.
    echo.
    echo Make sure:
    echo - WiFi is connected
    echo - Network adapter is active
    echo - ipconfig shows Wireless LAN adapter Wi-Fi
    pause
    exit /b
)

echo Active WiFi IP Detected: %IP%

echo.
echo ========================================
echo Starting Expo LAN Mode...
echo ========================================

set REACT_NATIVE_PACKAGER_HOSTNAME=%IP%

echo Hostname: %REACT_NATIVE_PACKAGER_HOSTNAME%

npx expo start --lan -c --go

pause