
export const MCP = {
  registry: {},

  register(name, config) {
    this.registry[name] = config;
  },

  async call(service, method, payload) {
    const mod = this.registry[service];
    if (!mod) throw new Error(`MCP: ${service} not registered`);
    return await mod[method](payload);
  }
};
