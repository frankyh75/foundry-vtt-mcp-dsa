#!/bin/bash
# Delete all test scenes via the delete-scene MCP tool
# Scene IDs from list_scenes output:

SCENE_IDS=(
  "UVemUauolPRdhm7Z"   # BG-Debug
  "MGwhxDEDFF8zSr6r"   # BG-Debug
  "D7ekxw833YwZNpSF"   # Bruchtal-BG-Final
  "zM9mmaf8xYizVgtD"   # Bruchtal-BG-Test
  "WV4Oc5SpTY53F5KN"   # Bruchtal-WS-Test
  "5Jq03PL8ZIMyu0NJ"   # Test-Szene
  "y6AhSMXN8CBpvv86"   # Test-Szene
  "1tLBVuD7VDHJIwau"   # Test-Szene-2
  "jBZrS29HKnZWy8SI"   # Test-Szene-3
  "1JL5tFJG7kwV6DQY"   # Test-Szene-Full
)

echo "Testing delete-scene with first scene..."
# This will be called via the MCP server's delete-scene tool
echo "Scenes to delete: ${#SCENE_IDS[@]}"
