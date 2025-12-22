import terser from '@rollup/plugin-terser';

const banner = `/*!
 * alpine-components
 * Lazy-loaded components with slots for Alpine.js
 * MIT License
 */`;

// Shared terser options
const terserOptions = {
    compress: {
        passes: 2
    },
    mangle: true,
    format: {
        comments: /^!/
    }
};

export default [
    // ESM builds
    {
        input: 'src/index.js',
        output: [
            {
                file: 'dist/module.esm.js',
                format: 'es',
                banner
            },
            {
                file: 'dist/module.esm.min.js',
                format: 'es',
                banner,
                plugins: [terser(terserOptions)]
            }
        ]
    },
    // CJS builds
    {
        input: 'src/index.js',
        output: [
            {
                file: 'dist/module.cjs.js',
                format: 'cjs',
                banner,
                exports: 'named'
            },
            {
                file: 'dist/module.cjs.min.js',
                format: 'cjs',
                banner,
                exports: 'named',
                plugins: [terser(terserOptions)]
            }
        ]
    },
    // IIFE builds (auto-loading)
    {
        input: 'src/iife.js',
        output: [
            {
                file: 'dist/cdn.js',
                format: 'iife',
                name: 'AlpineComponents',
                banner
            },
            {
                file: 'dist/cdn.min.js',
                format: 'iife',
                name: 'AlpineComponents',
                banner,
                plugins: [terser(terserOptions)]
            }
        ]
    }
];
