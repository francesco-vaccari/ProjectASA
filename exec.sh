#!/bin/bash

# Function to handle SIGINT signal
sigint_handler() {
    echo "Received SIGINT signal. Stopping processes..."
    
    # Terminate both processes
    kill $pid1 $pid2
    
    # Wait for processes to exit
    wait $pid1 2>/dev/null
    wait $pid2 2>/dev/null
    
    echo "Processes stopped."
    exit 0
}

# Register the SIGINT signal handler
trap 'sigint_handler' SIGINT

# Start the first command in the background and save its process ID
node index1.js &
pid1=$!

# Start the second command in the background and save its process ID
node index2.js &
pid2=$!

# Wait for both processes to complete
wait $pid1
wait $pid2

echo "Both processes completed."
exit 0