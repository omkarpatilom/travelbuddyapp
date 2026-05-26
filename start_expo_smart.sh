#!/bin/bash

echo "========================================"
echo "Detecting Active WiFi Network IP..."
echo "========================================"

IP=""

# Try to get IP from active default route interface
INTERFACE=$(ip route | grep default | awk '{print $5}' | head -n 1)

if [ -n "$INTERFACE" ]; then
    IP=$(ip -4 addr show "$INTERFACE" | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -n 1)
fi

# Fallback using hostname
if [ -z "$IP" ]; then
    IP=$(hostname -I | awk '{print $1}')
fi

# Fallback using route
if [ -z "$IP" ]; then
    IP=$(ip route get 1 | awk '{print $7; exit}')
fi

# Fallback using ifconfig
if [ -z "$IP" ]; then
    IP=$(ifconfig 2>/dev/null | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n 1)
fi

# Validate IP
if [ -z "$IP" ]; then
    echo "ERROR: Could not detect active network IP."
    exit 1
fi

echo "Active Interface: $INTERFACE"
echo "Active IP Detected: $IP"

echo ""
echo "========================================"
echo "Starting Expo LAN Mode..."
echo "========================================"

export REACT_NATIVE_PACKAGER_HOSTNAME=$IP

echo "Hostname: $REACT_NATIVE_PACKAGER_HOSTNAME"

npx expo start --lan -c --go