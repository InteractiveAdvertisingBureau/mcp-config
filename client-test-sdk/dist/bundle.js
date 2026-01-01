// node_modules/@a2a-js/sdk/dist/chunk-SJNAG4AL.js
var A2A_ERROR_CODE = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  TASK_NOT_FOUND: -32001,
  TASK_NOT_CANCELABLE: -32002,
  PUSH_NOTIFICATION_NOT_SUPPORTED: -32003,
  UNSUPPORTED_OPERATION: -32004,
  CONTENT_TYPE_NOT_SUPPORTED: -32005,
  INVALID_AGENT_RESPONSE: -32006,
  AUTHENTICATED_EXTENDED_CARD_NOT_CONFIGURED: -32007
};
var TaskNotFoundError = class extends Error {
  constructor(message) {
    super(message ?? "Task not found");
    this.name = "TaskNotFoundError";
  }
};
var TaskNotCancelableError = class extends Error {
  constructor(message) {
    super(message ?? "Task cannot be canceled");
    this.name = "TaskNotCancelableError";
  }
};
var PushNotificationNotSupportedError = class extends Error {
  constructor(message) {
    super(message ?? "Push Notification is not supported");
    this.name = "PushNotificationNotSupportedError";
  }
};
var UnsupportedOperationError = class extends Error {
  constructor(message) {
    super(message ?? "This operation is not supported");
    this.name = "UnsupportedOperationError";
  }
};
var ContentTypeNotSupportedError = class extends Error {
  constructor(message) {
    super(message ?? "Incompatible content types");
    this.name = "ContentTypeNotSupportedError";
  }
};
var InvalidAgentResponseError = class extends Error {
  constructor(message) {
    super(message ?? "Invalid agent response type");
    this.name = "InvalidAgentResponseError";
  }
};
var AuthenticatedExtendedCardNotConfiguredError = class extends Error {
  constructor(message) {
    super(message ?? "Authenticated Extended Card not configured");
    this.name = "AuthenticatedExtendedCardNotConfiguredError";
  }
};
async function* parseSseStream(response) {
  if (!response.body) {
    throw new Error("SSE response body is undefined. Cannot read stream.");
  }
  let buffer = "";
  let eventType = "message";
  let eventData = "";
  for await (const value of response.body.pipeThrough(new TextDecoderStream())) {
    buffer += value;
    let lineEndIndex;
    while ((lineEndIndex = buffer.indexOf("\n")) >= 0) {
      const line = buffer.substring(0, lineEndIndex).trim();
      buffer = buffer.substring(lineEndIndex + 1);
      if (line === "") {
        if (eventData) {
          yield { type: eventType, data: eventData };
          eventData = "";
          eventType = "message";
        }
      } else if (line.startsWith("event:")) {
        eventType = line.substring("event:".length).trim();
      } else if (line.startsWith("data:")) {
        eventData = line.substring("data:".length).trim();
      }
    }
  }
  if (eventData) {
    yield { type: eventType, data: eventData };
  }
}

// node_modules/@a2a-js/sdk/dist/chunk-3QDLXHKS.js
var AGENT_CARD_PATH = ".well-known/agent-card.json";

// node_modules/@a2a-js/sdk/dist/client/index.js
var JsonRpcTransport = class _JsonRpcTransport {
  customFetchImpl;
  endpoint;
  requestIdCounter = 1;
  constructor(options) {
    this.endpoint = options.endpoint;
    this.customFetchImpl = options.fetchImpl;
  }
  async getExtendedAgentCard(options, idOverride) {
    const rpcResponse = await this._sendRpcRequest("agent/getAuthenticatedExtendedCard", void 0, idOverride, options);
    return rpcResponse.result;
  }
  async sendMessage(params, options, idOverride) {
    const rpcResponse = await this._sendRpcRequest(
      "message/send",
      params,
      idOverride,
      options
    );
    return rpcResponse.result;
  }
  async *sendMessageStream(params, options) {
    yield* this._sendStreamingRequest("message/stream", params, options);
  }
  async setTaskPushNotificationConfig(params, options, idOverride) {
    const rpcResponse = await this._sendRpcRequest("tasks/pushNotificationConfig/set", params, idOverride, options);
    return rpcResponse.result;
  }
  async getTaskPushNotificationConfig(params, options, idOverride) {
    const rpcResponse = await this._sendRpcRequest("tasks/pushNotificationConfig/get", params, idOverride, options);
    return rpcResponse.result;
  }
  async listTaskPushNotificationConfig(params, options, idOverride) {
    const rpcResponse = await this._sendRpcRequest("tasks/pushNotificationConfig/list", params, idOverride, options);
    return rpcResponse.result;
  }
  async deleteTaskPushNotificationConfig(params, options, idOverride) {
    await this._sendRpcRequest("tasks/pushNotificationConfig/delete", params, idOverride, options);
  }
  async getTask(params, options, idOverride) {
    const rpcResponse = await this._sendRpcRequest(
      "tasks/get",
      params,
      idOverride,
      options
    );
    return rpcResponse.result;
  }
  async cancelTask(params, options, idOverride) {
    const rpcResponse = await this._sendRpcRequest(
      "tasks/cancel",
      params,
      idOverride,
      options
    );
    return rpcResponse.result;
  }
  async *resubscribeTask(params, options) {
    yield* this._sendStreamingRequest("tasks/resubscribe", params, options);
  }
  async callExtensionMethod(method, params, idOverride, options) {
    return await this._sendRpcRequest(
      method,
      params,
      idOverride,
      options
    );
  }
  _fetch(...args) {
    if (this.customFetchImpl) {
      return this.customFetchImpl(...args);
    }
    if (typeof fetch === "function") {
      return fetch(...args);
    }
    throw new Error(
      "A `fetch` implementation was not provided and is not available in the global scope. Please provide a `fetchImpl` in the A2ATransportOptions. "
    );
  }
  async _sendRpcRequest(method, params, idOverride, options) {
    const requestId = idOverride ?? this.requestIdCounter++;
    const rpcRequest = {
      jsonrpc: "2.0",
      method,
      params,
      id: requestId
    };
    const httpResponse = await this._fetchRpc(rpcRequest, "application/json", options);
    if (!httpResponse.ok) {
      let errorBodyText = "(empty or non-JSON response)";
      let errorJson;
      try {
        errorBodyText = await httpResponse.text();
        errorJson = JSON.parse(errorBodyText);
      } catch (e) {
        throw new Error(
          `HTTP error for ${method}! Status: ${httpResponse.status} ${httpResponse.statusText}. Response: ${errorBodyText}`,
          { cause: e }
        );
      }
      if (errorJson.jsonrpc && errorJson.error) {
        throw _JsonRpcTransport.mapToError(errorJson);
      } else {
        throw new Error(
          `HTTP error for ${method}! Status: ${httpResponse.status} ${httpResponse.statusText}. Response: ${errorBodyText}`
        );
      }
    }
    const rpcResponse = await httpResponse.json();
    if (rpcResponse.id !== requestId) {
      console.error(
        `CRITICAL: RPC response ID mismatch for method ${method}. Expected ${requestId}, got ${rpcResponse.id}.`
      );
    }
    if ("error" in rpcResponse) {
      throw _JsonRpcTransport.mapToError(rpcResponse);
    }
    return rpcResponse;
  }
  async _fetchRpc(rpcRequest, acceptHeader = "application/json", options) {
    const requestInit = {
      method: "POST",
      headers: {
        ...options?.serviceParameters,
        "Content-Type": "application/json",
        Accept: acceptHeader
      },
      body: JSON.stringify(rpcRequest),
      signal: options?.signal
    };
    return this._fetch(this.endpoint, requestInit);
  }
  async *_sendStreamingRequest(method, params, options) {
    const clientRequestId = this.requestIdCounter++;
    const rpcRequest = {
      jsonrpc: "2.0",
      method,
      params,
      id: clientRequestId
    };
    const response = await this._fetchRpc(rpcRequest, "text/event-stream", options);
    if (!response.ok) {
      let errorBody = "";
      let errorJson;
      try {
        errorBody = await response.text();
        errorJson = JSON.parse(errorBody);
      } catch (e) {
        throw new Error(
          `HTTP error establishing stream for ${method}: ${response.status} ${response.statusText}. Response: ${errorBody || "(empty)"}`,
          { cause: e }
        );
      }
      if (errorJson.error) {
        throw new Error(
          `HTTP error establishing stream for ${method}: ${response.status} ${response.statusText}. RPC Error: ${errorJson.error.message} (Code: ${errorJson.error.code})`
        );
      }
      throw new Error(
        `HTTP error establishing stream for ${method}: ${response.status} ${response.statusText}`
      );
    }
    if (!response.headers.get("Content-Type")?.startsWith("text/event-stream")) {
      throw new Error(
        `Invalid response Content-Type for SSE stream for ${method}. Expected 'text/event-stream'.`
      );
    }
    for await (const event of parseSseStream(response)) {
      yield this._processSseEventData(event.data, clientRequestId);
    }
  }
  _processSseEventData(jsonData, originalRequestId) {
    if (!jsonData.trim()) {
      throw new Error("Attempted to process empty SSE event data.");
    }
    try {
      const sseJsonRpcResponse = JSON.parse(jsonData);
      const a2aStreamResponse = sseJsonRpcResponse;
      if (a2aStreamResponse.id !== originalRequestId) {
        console.warn(
          `SSE Event's JSON-RPC response ID mismatch. Client request ID: ${originalRequestId}, event response ID: ${a2aStreamResponse.id}.`
        );
      }
      if ("error" in a2aStreamResponse) {
        const err = a2aStreamResponse.error;
        throw new Error(
          `SSE event contained an error: ${err.message} (Code: ${err.code}) Data: ${JSON.stringify(err.data || {})}`
        );
      }
      if (!("result" in a2aStreamResponse) || typeof a2aStreamResponse.result === "undefined") {
        throw new Error(`SSE event JSON-RPC response is missing 'result' field. Data: ${jsonData}`);
      }
      return a2aStreamResponse.result;
    } catch (e) {
      if (e instanceof Error && (e.message.startsWith("SSE event contained an error") || e.message.startsWith("SSE event JSON-RPC response is missing 'result' field"))) {
        throw e;
      }
      console.error(
        "Failed to parse SSE event data string or unexpected JSON-RPC structure:",
        jsonData,
        e
      );
      throw new Error(
        `Failed to parse SSE event data: "${jsonData.substring(0, 100)}...". Original error: ${e instanceof Error && e.message || "Unknown error"}`
      );
    }
  }
  static mapToError(response) {
    switch (response.error.code) {
      case -32001:
        return new TaskNotFoundJSONRPCError(response);
      case -32002:
        return new TaskNotCancelableJSONRPCError(response);
      case -32003:
        return new PushNotificationNotSupportedJSONRPCError(response);
      case -32004:
        return new UnsupportedOperationJSONRPCError(response);
      case -32005:
        return new ContentTypeNotSupportedJSONRPCError(response);
      case -32006:
        return new InvalidAgentResponseJSONRPCError(response);
      case -32007:
        return new AuthenticatedExtendedCardNotConfiguredJSONRPCError(response);
      default:
        return new JSONRPCTransportError(response);
    }
  }
};
var JsonRpcTransportFactory = class _JsonRpcTransportFactory {
  constructor(options) {
    this.options = options;
  }
  static name = "JSONRPC";
  get protocolName() {
    return _JsonRpcTransportFactory.name;
  }
  async create(url, _agentCard) {
    return new JsonRpcTransport({
      endpoint: url,
      fetchImpl: this.options?.fetchImpl
    });
  }
};
var JSONRPCTransportError = class extends Error {
  constructor(errorResponse) {
    super(
      `JSON-RPC error: ${errorResponse.error.message} (Code: ${errorResponse.error.code}) Data: ${JSON.stringify(errorResponse.error.data || {})}`
    );
    this.errorResponse = errorResponse;
  }
};
var TaskNotFoundJSONRPCError = class extends TaskNotFoundError {
  constructor(errorResponse) {
    super();
    this.errorResponse = errorResponse;
  }
};
var TaskNotCancelableJSONRPCError = class extends TaskNotCancelableError {
  constructor(errorResponse) {
    super();
    this.errorResponse = errorResponse;
  }
};
var PushNotificationNotSupportedJSONRPCError = class extends PushNotificationNotSupportedError {
  constructor(errorResponse) {
    super();
    this.errorResponse = errorResponse;
  }
};
var UnsupportedOperationJSONRPCError = class extends UnsupportedOperationError {
  constructor(errorResponse) {
    super();
    this.errorResponse = errorResponse;
  }
};
var ContentTypeNotSupportedJSONRPCError = class extends ContentTypeNotSupportedError {
  constructor(errorResponse) {
    super();
    this.errorResponse = errorResponse;
  }
};
var InvalidAgentResponseJSONRPCError = class extends InvalidAgentResponseError {
  constructor(errorResponse) {
    super();
    this.errorResponse = errorResponse;
  }
};
var AuthenticatedExtendedCardNotConfiguredJSONRPCError = class extends AuthenticatedExtendedCardNotConfiguredError {
  constructor(errorResponse) {
    super();
    this.errorResponse = errorResponse;
  }
};
var DefaultAgentCardResolver = class {
  constructor(options) {
    this.options = options;
  }
  /**
   * Fetches the agent card based on provided base URL and path.
   * Path is selected in the following order:
   * 1) path parameter
   * 2) path from options
   * 3) .well-known/agent-card.json
   */
  async resolve(baseUrl, path) {
    const agentCardUrl = new URL(path ?? this.options?.path ?? AGENT_CARD_PATH, baseUrl);
    const response = await this.fetchImpl(agentCardUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch Agent Card from ${agentCardUrl}: ${response.status}`);
    }
    return await response.json();
  }
  fetchImpl(...args) {
    if (this.options?.fetchImpl) {
      return this.options.fetchImpl(...args);
    }
    return fetch(...args);
  }
};
var AgentCardResolver = {
  default: new DefaultAgentCardResolver()
};
var Client = class {
  constructor(transport, agentCard, config) {
    this.transport = transport;
    this.agentCard = agentCard;
    this.config = config;
  }
  /**
   * If the current agent card supports the extended feature, it will try to fetch the extended agent card from the server,
   * Otherwise it will return the current agent card value.
   */
  async getAgentCard(options) {
    if (this.agentCard.supportsAuthenticatedExtendedCard) {
      this.agentCard = await this.executeWithInterceptors(
        { method: "getAgentCard" },
        options,
        (_, options2) => this.transport.getExtendedAgentCard(options2)
      );
    }
    return this.agentCard;
  }
  /**
   * Sends a message to an agent to initiate a new interaction or to continue an existing one.
   * Uses blocking mode by default.
   */
  sendMessage(params, options) {
    params = this.applyClientConfig({
      params,
      blocking: !(this.config?.polling ?? false)
    });
    return this.executeWithInterceptors(
      { method: "sendMessage", value: params },
      options,
      this.transport.sendMessage.bind(this.transport)
    );
  }
  /**
   * Sends a message to an agent to initiate/continue a task AND subscribes the client to real-time updates for that task.
   * Performs fallback to non-streaming if not supported by the agent.
   */
  async *sendMessageStream(params, options) {
    const method = "sendMessageStream";
    params = this.applyClientConfig({ params, blocking: true });
    const beforeArgs = {
      input: { method, value: params },
      agentCard: this.agentCard,
      options
    };
    const beforeResult = await this.interceptBefore(beforeArgs);
    if (beforeResult) {
      const earlyReturn = beforeResult.earlyReturn.value;
      const afterArgs = {
        result: { method, value: earlyReturn },
        agentCard: this.agentCard,
        options: beforeArgs.options
      };
      await this.interceptAfter(afterArgs, beforeResult.executed);
      yield afterArgs.result.value;
      return;
    }
    if (!this.agentCard.capabilities.streaming) {
      const result = await this.transport.sendMessage(beforeArgs.input.value, beforeArgs.options);
      const afterArgs = {
        result: { method, value: result },
        agentCard: this.agentCard,
        options: beforeArgs.options
      };
      await this.interceptAfter(afterArgs);
      yield afterArgs.result.value;
      return;
    }
    for await (const event of this.transport.sendMessageStream(
      beforeArgs.input.value,
      beforeArgs.options
    )) {
      const afterArgs = {
        result: { method, value: event },
        agentCard: this.agentCard,
        options: beforeArgs.options
      };
      await this.interceptAfter(afterArgs);
      yield afterArgs.result.value;
      if (afterArgs.earlyReturn) {
        return;
      }
    }
  }
  /**
   * Sets or updates the push notification configuration for a specified task.
   * Requires the server to have AgentCard.capabilities.pushNotifications: true.
   */
  setTaskPushNotificationConfig(params, options) {
    if (!this.agentCard.capabilities.pushNotifications) {
      throw new PushNotificationNotSupportedError();
    }
    return this.executeWithInterceptors(
      { method: "setTaskPushNotificationConfig", value: params },
      options,
      this.transport.setTaskPushNotificationConfig.bind(this.transport)
    );
  }
  /**
   * Retrieves the current push notification configuration for a specified task.
   * Requires the server to have AgentCard.capabilities.pushNotifications: true.
   */
  getTaskPushNotificationConfig(params, options) {
    if (!this.agentCard.capabilities.pushNotifications) {
      throw new PushNotificationNotSupportedError();
    }
    return this.executeWithInterceptors(
      { method: "getTaskPushNotificationConfig", value: params },
      options,
      this.transport.getTaskPushNotificationConfig.bind(this.transport)
    );
  }
  /**
   * Retrieves the associated push notification configurations for a specified task.
   * Requires the server to have AgentCard.capabilities.pushNotifications: true.
   */
  listTaskPushNotificationConfig(params, options) {
    if (!this.agentCard.capabilities.pushNotifications) {
      throw new PushNotificationNotSupportedError();
    }
    return this.executeWithInterceptors(
      { method: "listTaskPushNotificationConfig", value: params },
      options,
      this.transport.listTaskPushNotificationConfig.bind(this.transport)
    );
  }
  /**
   * Deletes an associated push notification configuration for a task.
   */
  deleteTaskPushNotificationConfig(params, options) {
    return this.executeWithInterceptors(
      { method: "deleteTaskPushNotificationConfig", value: params },
      options,
      this.transport.deleteTaskPushNotificationConfig.bind(this.transport)
    );
  }
  /**
   * Retrieves the current state (including status, artifacts, and optionally history) of a previously initiated task.
   */
  getTask(params, options) {
    return this.executeWithInterceptors(
      { method: "getTask", value: params },
      options,
      this.transport.getTask.bind(this.transport)
    );
  }
  /**
   * Requests the cancellation of an ongoing task. The server will attempt to cancel the task,
   * but success is not guaranteed (e.g., the task might have already completed or failed, or cancellation might not be supported at its current stage).
   */
  cancelTask(params, options) {
    return this.executeWithInterceptors(
      { method: "cancelTask", value: params },
      options,
      this.transport.cancelTask.bind(this.transport)
    );
  }
  /**
   * Allows a client to reconnect to an updates stream for an ongoing task after a previous connection was interrupted.
   */
  async *resubscribeTask(params, options) {
    const method = "resubscribeTask";
    const beforeArgs = {
      input: { method, value: params },
      agentCard: this.agentCard,
      options
    };
    const beforeResult = await this.interceptBefore(beforeArgs);
    if (beforeResult) {
      const earlyReturn = beforeResult.earlyReturn.value;
      const afterArgs = {
        result: { method, value: earlyReturn },
        agentCard: this.agentCard,
        options: beforeArgs.options
      };
      await this.interceptAfter(afterArgs, beforeResult.executed);
      yield afterArgs.result.value;
      return;
    }
    for await (const event of this.transport.resubscribeTask(
      beforeArgs.input.value,
      beforeArgs.options
    )) {
      const afterArgs = {
        result: { method, value: event },
        agentCard: this.agentCard,
        options: beforeArgs.options
      };
      await this.interceptAfter(afterArgs);
      yield afterArgs.result.value;
      if (afterArgs.earlyReturn) {
        return;
      }
    }
  }
  applyClientConfig({
    params,
    blocking
  }) {
    const result = { ...params, configuration: params.configuration ?? {} };
    if (!result.configuration.acceptedOutputModes && this.config?.acceptedOutputModes) {
      result.configuration.acceptedOutputModes = this.config.acceptedOutputModes;
    }
    if (!result.configuration.pushNotificationConfig && this.config?.pushNotificationConfig) {
      result.configuration.pushNotificationConfig = this.config.pushNotificationConfig;
    }
    result.configuration.blocking ??= blocking;
    return result;
  }
  async executeWithInterceptors(input, options, transportCall) {
    const beforeArgs = {
      input,
      agentCard: this.agentCard,
      options
    };
    const beforeResult = await this.interceptBefore(beforeArgs);
    if (beforeResult) {
      const afterArgs2 = {
        result: {
          method: input.method,
          value: beforeResult.earlyReturn.value
        },
        agentCard: this.agentCard,
        options: beforeArgs.options
      };
      await this.interceptAfter(afterArgs2, beforeResult.executed);
      return afterArgs2.result.value;
    }
    const result = await transportCall(beforeArgs.input.value, beforeArgs.options);
    const afterArgs = {
      result: { method: input.method, value: result },
      agentCard: this.agentCard,
      options: beforeArgs.options
    };
    await this.interceptAfter(afterArgs);
    return afterArgs.result.value;
  }
  async interceptBefore(args) {
    if (!this.config?.interceptors || this.config.interceptors.length === 0) {
      return;
    }
    const executed = [];
    for (const interceptor of this.config.interceptors) {
      await interceptor.before(args);
      executed.push(interceptor);
      if (args.earlyReturn) {
        return {
          earlyReturn: args.earlyReturn,
          executed
        };
      }
    }
  }
  async interceptAfter(args, interceptors) {
    const reversedInterceptors = [...interceptors ?? this.config?.interceptors ?? []].reverse();
    for (const interceptor of reversedInterceptors) {
      await interceptor.after(args);
      if (args.earlyReturn) {
        return;
      }
    }
  }
};
var RestTransport = class _RestTransport {
  customFetchImpl;
  endpoint;
  constructor(options) {
    this.endpoint = options.endpoint.replace(/\/+$/, "");
    this.customFetchImpl = options.fetchImpl;
  }
  async getExtendedAgentCard(options) {
    return this._sendRequest("GET", "/v1/card", void 0, options);
  }
  async sendMessage(params, options) {
    return this._sendRequest("POST", "/v1/message:send", params, options);
  }
  async *sendMessageStream(params, options) {
    yield* this._sendStreamingRequest("/v1/message:stream", params, options);
  }
  async setTaskPushNotificationConfig(params, options) {
    return this._sendRequest(
      "POST",
      `/v1/tasks/${encodeURIComponent(params.taskId)}/pushNotificationConfigs`,
      {
        pushNotificationConfig: params.pushNotificationConfig
      },
      options
    );
  }
  async getTaskPushNotificationConfig(params, options) {
    const { pushNotificationConfigId } = params;
    if (!pushNotificationConfigId) {
      throw new Error(
        "pushNotificationConfigId is required for getTaskPushNotificationConfig with REST transport."
      );
    }
    return this._sendRequest(
      "GET",
      `/v1/tasks/${encodeURIComponent(params.id)}/pushNotificationConfigs/${encodeURIComponent(pushNotificationConfigId)}`,
      void 0,
      options
    );
  }
  async listTaskPushNotificationConfig(params, options) {
    return this._sendRequest(
      "GET",
      `/v1/tasks/${encodeURIComponent(params.id)}/pushNotificationConfigs`,
      void 0,
      options
    );
  }
  async deleteTaskPushNotificationConfig(params, options) {
    await this._sendRequest(
      "DELETE",
      `/v1/tasks/${encodeURIComponent(params.id)}/pushNotificationConfigs/${encodeURIComponent(params.pushNotificationConfigId)}`,
      void 0,
      options
    );
  }
  async getTask(params, options) {
    const queryParams = new URLSearchParams();
    if (params.historyLength !== void 0) {
      queryParams.set("historyLength", String(params.historyLength));
    }
    const queryString = queryParams.toString();
    const path = `/v1/tasks/${encodeURIComponent(params.id)}${queryString ? `?${queryString}` : ""}`;
    return this._sendRequest("GET", path, void 0, options);
  }
  async cancelTask(params, options) {
    return this._sendRequest(
      "POST",
      `/v1/tasks/${encodeURIComponent(params.id)}:cancel`,
      void 0,
      options
    );
  }
  async *resubscribeTask(params, options) {
    yield* this._sendStreamingRequest(
      `/v1/tasks/${encodeURIComponent(params.id)}:subscribe`,
      void 0,
      options
    );
  }
  _fetch(...args) {
    if (this.customFetchImpl) {
      return this.customFetchImpl(...args);
    }
    if (typeof fetch === "function") {
      return fetch(...args);
    }
    throw new Error(
      "A `fetch` implementation was not provided and is not available in the global scope. Please provide a `fetchImpl` in the RestTransportOptions."
    );
  }
  _buildHeaders(options, acceptHeader = "application/json") {
    return {
      ...options?.serviceParameters,
      "Content-Type": "application/json",
      Accept: acceptHeader
    };
  }
  async _sendRequest(method, path, body, options) {
    const url = `${this.endpoint}${path}`;
    const requestInit = {
      method,
      headers: this._buildHeaders(options),
      signal: options?.signal
    };
    if (body !== void 0 && method !== "GET") {
      requestInit.body = JSON.stringify(body);
    }
    const response = await this._fetch(url, requestInit);
    if (!response.ok) {
      await this._handleErrorResponse(response, path);
    }
    if (response.status === 204) {
      return void 0;
    }
    const result = await response.json();
    return result;
  }
  async _handleErrorResponse(response, path) {
    let errorBodyText = "(empty or non-JSON response)";
    let errorBody;
    try {
      errorBodyText = await response.text();
      if (errorBodyText) {
        errorBody = JSON.parse(errorBodyText);
      }
    } catch (e) {
      throw new Error(
        `HTTP error for ${path}! Status: ${response.status} ${response.statusText}. Response: ${errorBodyText}`,
        { cause: e }
      );
    }
    if (errorBody && typeof errorBody.code === "number") {
      throw _RestTransport.mapToError(errorBody);
    }
    throw new Error(
      `HTTP error for ${path}! Status: ${response.status} ${response.statusText}. Response: ${errorBodyText}`
    );
  }
  async *_sendStreamingRequest(path, body, options) {
    const url = `${this.endpoint}${path}`;
    const requestInit = {
      method: "POST",
      headers: this._buildHeaders(options, "text/event-stream"),
      signal: options?.signal
    };
    if (body !== void 0) {
      requestInit.body = JSON.stringify(body);
    }
    const response = await this._fetch(url, requestInit);
    if (!response.ok) {
      await this._handleErrorResponse(response, path);
    }
    const contentType = response.headers.get("Content-Type");
    if (!contentType?.startsWith("text/event-stream")) {
      throw new Error(
        `Invalid response Content-Type for SSE stream. Expected 'text/event-stream', got '${contentType}'.`
      );
    }
    for await (const event of parseSseStream(response)) {
      if (event.type === "error") {
        const errorData = JSON.parse(event.data);
        throw _RestTransport.mapToError(errorData);
      }
      yield this._processSseEventData(event.data);
    }
  }
  _processSseEventData(jsonData) {
    if (!jsonData.trim()) {
      throw new Error("Attempted to process empty SSE event data.");
    }
    try {
      const data = JSON.parse(jsonData);
      return data;
    } catch (e) {
      console.error("Failed to parse SSE event data:", jsonData, e);
      throw new Error(
        `Failed to parse SSE event data: "${jsonData.substring(0, 100)}...". Original error: ${e instanceof Error && e.message || "Unknown error"}`
      );
    }
  }
  static mapToError(error) {
    switch (error.code) {
      case A2A_ERROR_CODE.TASK_NOT_FOUND:
        return new TaskNotFoundError(error.message);
      case A2A_ERROR_CODE.TASK_NOT_CANCELABLE:
        return new TaskNotCancelableError(error.message);
      case A2A_ERROR_CODE.PUSH_NOTIFICATION_NOT_SUPPORTED:
        return new PushNotificationNotSupportedError(error.message);
      case A2A_ERROR_CODE.UNSUPPORTED_OPERATION:
        return new UnsupportedOperationError(error.message);
      case A2A_ERROR_CODE.CONTENT_TYPE_NOT_SUPPORTED:
        return new ContentTypeNotSupportedError(error.message);
      case A2A_ERROR_CODE.INVALID_AGENT_RESPONSE:
        return new InvalidAgentResponseError(error.message);
      case A2A_ERROR_CODE.AUTHENTICATED_EXTENDED_CARD_NOT_CONFIGURED:
        return new AuthenticatedExtendedCardNotConfiguredError(error.message);
      default:
        return new Error(
          `REST error: ${error.message} (Code: ${error.code})${error.data ? ` Data: ${JSON.stringify(error.data)}` : ""}`
        );
    }
  }
};
var RestTransportFactory = class _RestTransportFactory {
  constructor(options) {
    this.options = options;
  }
  static name = "HTTP+JSON";
  get protocolName() {
    return _RestTransportFactory.name;
  }
  async create(url, _agentCard) {
    return new RestTransport({
      endpoint: url,
      fetchImpl: this.options?.fetchImpl
    });
  }
};
var ClientFactoryOptions = {
  /**
   * SDK default options for {@link ClientFactory}.
   */
  default: {
    transports: [new JsonRpcTransportFactory(), new RestTransportFactory()]
  },
  /**
   * Creates new options by merging an original and an override object.
   * Transports are merged based on `TransportFactory.protocolName`,
   * interceptors are concatenated, other fields are overriden.
   *
   * @example
   * ```ts
   * const options = ClientFactoryOptions.createFrom(ClientFactoryOptions.default, {
   *  transports: [new MyCustomTransportFactory()], // adds a custom transport
   *  clientConfig: { interceptors: [new MyInterceptor()] }, // adds a custom interceptor
   * });
   * ```
   */
  createFrom(original, overrides) {
    return {
      ...original,
      ...overrides,
      transports: mergeTransports(original.transports, overrides.transports),
      clientConfig: {
        ...original.clientConfig ?? {},
        ...overrides.clientConfig ?? {},
        interceptors: mergeArrays(
          original.clientConfig?.interceptors,
          overrides.clientConfig?.interceptors
        ),
        acceptedOutputModes: overrides.clientConfig?.acceptedOutputModes ?? original.clientConfig?.acceptedOutputModes
      },
      preferredTransports: overrides.preferredTransports ?? original.preferredTransports
    };
  }
};
var ClientFactory = class {
  constructor(options = ClientFactoryOptions.default) {
    this.options = options;
    if (!options.transports || options.transports.length === 0) {
      throw new Error("No transports provided");
    }
    this.transportsByName = transportsByName(options.transports);
    for (const transport of options.preferredTransports ?? []) {
      const factory = this.options.transports.find((t) => t.protocolName === transport);
      if (!factory) {
        throw new Error(
          `Unknown preferred transport: ${transport}, available transports: ${[...this.transportsByName.keys()].join()}`
        );
      }
    }
    this.agentCardResolver = options.cardResolver ?? AgentCardResolver.default;
  }
  transportsByName;
  agentCardResolver;
  /**
   * Creates a new client from the provided agent card.
   */
  async createFromAgentCard(agentCard) {
    const agentCardPreferred = agentCard.preferredTransport ?? JsonRpcTransportFactory.name;
    const additionalInterfaces = agentCard.additionalInterfaces ?? [];
    const urlsPerAgentTransports = new Map([
      [agentCardPreferred, agentCard.url],
      ...additionalInterfaces.map((i) => [i.transport, i.url])
    ]);
    const transportsByPreference = [
      ...this.options.preferredTransports ?? [],
      agentCardPreferred,
      ...additionalInterfaces.map((i) => i.transport)
    ];
    for (const transport of transportsByPreference) {
      if (!urlsPerAgentTransports.has(transport)) {
        continue;
      }
      const factory = this.transportsByName.get(transport);
      if (!factory) {
        continue;
      }
      return new Client(
        await factory.create(urlsPerAgentTransports.get(transport), agentCard),
        agentCard,
        this.options.clientConfig
      );
    }
    throw new Error(
      "No compatible transport found, available transports: " + [...this.transportsByName.keys()].join()
    );
  }
  /**
   * Downloads agent card using AgentCardResolver from options
   * and creates a new client from the downloaded card.
   *
   * @example
   * ```ts
   * const factory = new ClientFactory(); // use default options and default {@link AgentCardResolver}.
   * const client1 = await factory.createFromUrl('https://example.com'); // /.well-known/agent-card.json is used by default
   * const client2 = await factory.createFromUrl('https://example.com', '/my-agent-card.json'); // specify custom path
   * const client3 = await factory.createFromUrl('https://example.com/my-agent-card.json', ''); // specify full URL and set path to empty
   * ```
   */
  async createFromUrl(baseUrl, path) {
    const agentCard = await this.agentCardResolver.resolve(baseUrl, path);
    return this.createFromAgentCard(agentCard);
  }
};
function mergeTransports(original, overrides) {
  if (!overrides) {
    return original;
  }
  const result = transportsByName(original);
  const overridesByName = transportsByName(overrides);
  for (const [name, factory] of overridesByName) {
    result.set(name, factory);
  }
  return Array.from(result.values());
}
function transportsByName(transports) {
  const result = /* @__PURE__ */ new Map();
  if (!transports) {
    return result;
  }
  for (const t of transports) {
    if (result.has(t.protocolName)) {
      throw new Error(`Duplicate protocol name: ${t.protocolName}`);
    }
    result.set(t.protocolName, t);
  }
  return result;
}
function mergeArrays(a1, a2) {
  if (!a1 && !a2) {
    return void 0;
  }
  return [...a1 ?? [], ...a2 ?? []];
}

// src/app.js
var A2ASDKClient = class {
  constructor() {
    this.serverUrl = "https://mcpclient.iabtechlab.com";
    this.currentAgent = "buyer";
    this.clientFactory = new ClientFactory();
    this.client = null;
    this.agentCard = null;
    this.tasks = /* @__PURE__ */ new Map();
    this.initializeUI();
  }
  initializeUI() {
    document.getElementById("connectBtn").addEventListener("click", () => this.connect());
    document.querySelectorAll('input[name="agent"]').forEach((radio) => {
      radio.addEventListener("change", (e) => {
        this.currentAgent = e.target.value;
        this.client = null;
        this.agentCard = null;
        document.getElementById("agentInfo").style.display = "none";
        document.getElementById("sendBtn").disabled = true;
      });
    });
    document.getElementById("sendBtn").addEventListener("click", () => this.sendMessage());
    document.getElementById("messageInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    document.querySelectorAll(".quick-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const message = e.target.dataset.message;
        document.getElementById("messageInput").value = message;
        this.sendMessage();
      });
    });
    document.getElementById("clearDebugBtn").addEventListener("click", () => {
      document.getElementById("debugLog").innerHTML = "";
    });
    document.getElementById("serverUrl").addEventListener("change", (e) => {
      this.serverUrl = e.target.value;
    });
  }
  async connect() {
    const btn = document.getElementById("connectBtn");
    btn.disabled = true;
    btn.innerHTML = 'Connecting... <span class="loading"></span>';
    try {
      this.log("info", `\u{1F50C} Connecting to ${this.currentAgent} agent using @a2a-js/sdk ClientFactory`);
      const agentCardUrl = `${this.serverUrl}/a2a/${this.currentAgent}/.well-known/agent-card.json`;
      this.log("info", `\u{1F4E5} Fetching agent card: ${agentCardUrl}`);
      this.client = await this.clientFactory.createFromUrl(agentCardUrl, "");
      const response = await fetch(agentCardUrl);
      this.agentCard = await response.json();
      this.log("info", `\u2705 Connected via @a2a-js/sdk ClientFactory`);
      this.log("info", `   Agent: ${this.agentCard.name}`);
      this.log("info", `   Protocol: ${this.agentCard.protocolVersion}`);
      this.displayAgentInfo();
      document.getElementById("sendBtn").disabled = false;
      this.addSystemMessage(`\u2705 Connected to ${this.agentCard.name} using official @a2a-js/sdk`);
    } catch (error) {
      this.log("error", `\u274C Connection failed: ${error.message}`);
      this.addSystemMessage(`\u274C Connection failed: ${error.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = "Connect";
    }
  }
  displayAgentInfo() {
    const infoDiv = document.getElementById("agentInfo");
    const detailsDiv = document.getElementById("agentDetails");
    const skills = this.agentCard.skills.map((s) => s.name).join(", ");
    const protocols = this.agentCard.additionalInterfaces.map((i) => i.protocol).join(", ");
    detailsDiv.innerHTML = `
            <div class="detail-item">
                <span class="detail-label">Name:</span> ${this.agentCard.name}
            </div>
            <div class="detail-item">
                <span class="detail-label">Protocol Version:</span> ${this.agentCard.protocolVersion}
            </div>
            <div class="detail-item">
                <span class="detail-label">SDK:</span> @a2a-js/sdk/client (Official)
            </div>
            <div class="detail-item">
                <span class="detail-label">Skills:</span> ${skills}
            </div>
            <div class="detail-item">
                <span class="detail-label">Supported Protocols:</span> ${protocols}
            </div>
            <div class="detail-item">
                <span class="detail-label">Streaming:</span> ${this.agentCard.capabilities.streaming ? "\u2705" : "\u274C"}
            </div>
        `;
    infoDiv.style.display = "block";
  }
  async sendMessage() {
    const input = document.getElementById("messageInput");
    const messageText = input.value.trim();
    if (!messageText) return;
    if (!this.client) {
      alert("Please connect to an agent first");
      return;
    }
    input.value = "";
    this.addUserMessage(messageText);
    try {
      this.log("info", `\u{1F4E4} Sending message via @a2a-js/sdk: "${messageText}"`);
      const message = {
        messageId: this.generateId(),
        role: "user",
        parts: [{
          kind: "text",
          text: messageText
        }],
        kind: "message"
      };
      const response = await this.client.sendMessage({ message });
      this.log("info", `\u{1F4E8} Response received from SDK`);
      this.log("info", `   Response type: ${JSON.stringify(response).substring(0, 100)}...`);
      const task = response.task || response;
      if (task) {
        this.handleTask(task);
      }
    } catch (error) {
      this.log("error", `\u274C Failed to send message: ${error.message}`);
      this.addSystemMessage(`\u274C Error: ${error.message}`);
    }
  }
  handleTask(task) {
    this.log("info", `\u{1F4CB} Task created: ${task.id}, status: ${task.status.state}`);
    this.tasks.set(task.id, task);
    this.updateTaskList();
    if (task.history && task.history.length > 1) {
      const agentMessages = task.history.filter((h) => h.role === "agent");
      agentMessages.forEach((msg) => {
        const text = msg.parts?.[0]?.text || "";
        if (text) {
          this.addAgentMessage(text);
        }
      });
    }
    if (task.status.state === "working") {
      this.pollTask(task.id);
    }
  }
  async pollTask(taskId) {
    const maxAttempts = 30;
    let attempts = 0;
    let shownAgentMessages = 0;
    const existingTask = this.tasks.get(taskId);
    if (existingTask?.history) {
      shownAgentMessages = existingTask.history.filter((h) => h.role === "agent").length;
    }
    const poll = async () => {
      if (attempts++ >= maxAttempts) {
        this.log("error", `\u23F1\uFE0F Task ${taskId} polling timeout`);
        return;
      }
      try {
        const response = await this.client.getTask({ taskId });
        const task = response.task || response;
        this.tasks.set(taskId, task);
        this.updateTaskList();
        const agentMessages = task.history.filter((h) => h.role === "agent");
        if (agentMessages.length > shownAgentMessages) {
          const newMessages = agentMessages.slice(shownAgentMessages);
          this.log("info", `\u{1F4AC} Found ${newMessages.length} new agent messages`);
          newMessages.forEach((msg) => {
            const text = msg.parts?.[0]?.text || "";
            if (text) {
              this.addAgentMessage(text);
            }
          });
          shownAgentMessages = agentMessages.length;
        }
        if (task.status.state === "completed") {
          this.log("info", `\u2705 Task ${taskId} completed`);
        } else if (task.status.state === "failed") {
          this.log("error", `\u274C Task ${taskId} failed`);
        } else if (task.status.state === "working") {
          setTimeout(poll, 1e3);
        }
      } catch (error) {
        this.log("error", `\u274C Failed to poll task ${taskId}: ${error.message}`);
      }
    };
    poll();
  }
  updateTaskList() {
    const listDiv = document.getElementById("taskList");
    if (this.tasks.size === 0) {
      listDiv.innerHTML = '<div class="empty-state">No active tasks</div>';
      return;
    }
    listDiv.innerHTML = "";
    const taskArray = Array.from(this.tasks.values()).reverse();
    taskArray.forEach((task) => {
      const taskDiv = document.createElement("div");
      taskDiv.className = "task-item";
      const userMessage = task.history.find((h) => h.role === "user");
      const userText = userMessage?.parts?.[0]?.text || "No message";
      taskDiv.innerHTML = `
                <div class="task-header">
                    <span class="task-id">\u{1F194} ${task.id.substring(0, 8)}...</span>
                    <span class="task-status status-${task.status.state}">${task.status.state}</span>
                </div>
                <div class="task-content">
                    <strong>Request:</strong> ${userText}
                </div>
            `;
      listDiv.appendChild(taskDiv);
    });
  }
  addUserMessage(text) {
    this.addMessage("user", "\u{1F464} You", text);
  }
  addAgentMessage(text) {
    this.addMessage("agent", "\u{1F916} Agent", text);
  }
  addSystemMessage(text) {
    this.addMessage("system", "\u2699\uFE0F System", text);
  }
  addMessage(type, header, text) {
    const messagesDiv = document.getElementById("chatMessages");
    const messageDiv = document.createElement("div");
    messageDiv.className = `message message-${type}`;
    messageDiv.innerHTML = `
            <div class="message-header">${header}</div>
            <div class="message-content">${this.escapeHtml(text)}</div>
        `;
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
  log(level, message) {
    const logDiv = document.getElementById("debugLog");
    const entry = document.createElement("div");
    entry.className = `debug-entry debug-${level}`;
    const timestamp = (/* @__PURE__ */ new Date()).toLocaleTimeString();
    entry.innerHTML = `<span class="debug-timestamp">[${timestamp}]</span> ${this.escapeHtml(message)}`;
    logDiv.appendChild(entry);
    logDiv.scrollTop = logDiv.scrollHeight;
    console.log(`[${level.toUpperCase()}] ${message}`);
  }
  generateId() {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
};
document.addEventListener("DOMContentLoaded", () => {
  window.a2aSDKClient = new A2ASDKClient();
  console.log("\u2705 A2A SDK Client initialized with @a2a-js/sdk/client");
  console.log("\u{1F4E6} Using official ClientFactory from @a2a-js/sdk");
});
