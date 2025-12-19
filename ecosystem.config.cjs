module.exports = {
  apps: [
    {
      name: "code-convos-server",
      script: "./server/index.js",
      env: {
        NODE_ENV: "production",
        PORT: 4001
      }
    }
  ]
};
