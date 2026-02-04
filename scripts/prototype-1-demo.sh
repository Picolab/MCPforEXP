npm run teardown

pico-engine &> /dev/null &
PICO_PID=$!
echo "Pico server started with PID: $PICO_PID"

echo "Waiting to make sure pico-engine is listening..."
sleep 5

npm run setup

MANIFOLD_ECI=$(node -e "require('../src/backend/api-wrapper.js').main()")
echo "Manifold ECI: $MANIFOLD_ECI"

echo "Creating 'Blue Travel Case'"
THING_ENGINE_ECI=$(node -e "require('../src/backend/api-wrapper.js').createThing('$MANIFOLD_ECI', 'Blue Travel Case')")
echo Blue Travel Case ECI: $THING_ENGINE_ECI

echo "Attaching a note"
echo "NOT IMPLEMENTED"

echo "Setting SquareTag 'AAABBB'"
node -e "require('../src/backend/api-wrapper.js').addTags('$THING_ENGINE_ECI', 'AAABBB')"

echo "Updating owner information"
echo "NOT IMPLEMENTED"

echo "calling listThings()"
node -e "require('../src/backend/api-wrapper.js').listThings('$MANIFOLD_ECI')"

kill $PICO_PID
echo "Pico server shut down"