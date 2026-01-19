const { get_manifold_pico } = require('./api-wrapper');

// test('get_manifold_pico with valid ECI', async () => {
//     try {
//         const data = await get_manifold_pico("cmklhoq6x002gxgeuaann7tb0");
//         console.log(data);
//         expect(data.name).toBe('Manifold');
//         expect(data.eci).toBeDefined();
//         expect(data.parent_eci).toBeDefined();
//     } catch (error) {
//         throw error;
//     }
// })

test('get_manifold_pico with invalid ECI', async () => {
    const data = await (get_manifold_pico("invalid ECI"));
    expect(data.error).toBe('Error: ECI not found invalid ECI');
})