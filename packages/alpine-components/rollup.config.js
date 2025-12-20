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
                file: 'dist/alpine-components.esm.js',
                format: 'es',
                banner
            },
            {
                file: 'dist/alpine-components.esm.min.js',
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
                file: 'dist/alpine-components.cjs.js',
                format: 'cjs',
                banner,
                exports: 'named'
            },
            {
                file: 'dist/alpine-components.cjs.min.js',
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
                file: 'dist/alpine-components.js',
                format: 'iife',
                name: 'AlpineComponents',
                banner
            },
            {
                file: 'dist/alpine-components.min.js',
                format: 'iife',
                name: 'AlpineComponents',
                banner,
                plugins: [terser(terserOptions)]
            }
        ]
    }
];

