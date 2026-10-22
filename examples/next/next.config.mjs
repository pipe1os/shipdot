// BASE_PATH is set when the docs workflow exports this example to GitHub Pages.
const basePath = process.env.BASE_PATH ?? ''

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath,
  env: { BASE_PATH: basePath },
}

export default nextConfig
