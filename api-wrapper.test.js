const { getInitialECI } = require('./api-wrapper');

test('get initial ECI', async () => {
    try {
        const eci = await getInitialECI();
        expect(eci).toBeDefined();
    } catch (error) {
        throw error;
    }
})