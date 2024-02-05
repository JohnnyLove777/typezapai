module.exports = {
    apps: [
      {
        name: 'typeListener',
        script: 'typeListener.js',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '145M'
      }
    ]
  };
  