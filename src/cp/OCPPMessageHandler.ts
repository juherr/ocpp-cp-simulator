import {
  OcppMessagePayloadV16,
  OcppMessageResponsePayloadV16,
  OCPPWebSocket,
} from "./OCPPWebSocket";
import { ChargePoint } from "./ChargePoint";
import { Transaction } from "./Transaction";
import { Logger } from "./Logger";
import {
  BootNotification,
  OcppConfigurationKey,
  OCPPStatus,
} from "./OcppTypes";
import { UploadFile } from "./file_upload.ts";
import {
  ArrayConfigurationValue,
  BooleanConfigurationValue,
  Configuration,
  ConfigurationValue,
  defaultConfiguration,
  IntegerConfigurationValue,
  StringConfigurationValue,
} from "./Configuration.ts";

import {
  ActionV16,
  AuthorizeResponseV16,
  BootNotificationResponseV16,
  ChangeAvailabilityRequestV16,
  ChangeAvailabilityResponseV16,
  ChangeConfigurationResponseV16,
  ClearCacheRequestV16,
  ClearCacheResponseV16,
  DataTransferResponseV16,
  GetConfigurationRequestV16,
  GetConfigurationResponseV16,
  GetDiagnosticsResponseV16,
  HeartbeatResponseV16,
  isValidAuthorizeResponseV16,
  isValidBootNotificationResponseV16,
  isValidChangeAvailabilityRequestV16,
  isValidChangeConfigurationRequestV16,
  isValidClearCacheRequestV16,
  isValidDataTransferResponseV16,
  isValidGetConfigurationRequestV16,
  isValidGetDiagnosticsRequestV16,
  isValidHeartbeatResponseV16,
  isValidMeterValuesResponseV16,
  isValidRemoteStartTransactionRequestV16,
  isValidRemoteStopTransactionRequestV16,
  isValidResetRequestV16,
  isValidRpcCallErrorV16,
  isValidRpcCallResultV16,
  isValidStartTransactionResponseV16,
  isValidStatusNotificationResponseV16,
  isValidStopTransactionResponseV16,
  isValidTriggerMessageRequestV16,
  isValidUnlockConnectorRequestV16,
  MeterValuesRequestV16,
  MeterValuesResponseV16,
  OCPPCallErrorV16,
  OCPPCallResultV16,
  OCPPCallV16,
  OCPPErrorCodeV16,
  OCPPMessageType,
  RemoteStartTransactionResponseV16,
  RemoteStopTransactionResponseV16,
  ResetResponseV16,
  StartTransactionResponseV16,
  StatusNotificationRequestV16,
  StopTransactionResponseV16,
  TriggerMessageResponseV16,
  UnlockConnectorRequestV16,
  UnlockConnectorResponseV16,
} from "@cshil/ocpp-tools";
import { isValidRpcCallV16 } from "@cshil/ocpp-tools/validation/v16";
import type {
  ChangeConfigurationRequestV16,
  GetDiagnosticsRequestV16,
  RemoteStartTransactionRequestV16,
  RemoteStopTransactionRequestV16,
  ResetRequestV16,
  RpcCallErrorV16,
  RpcCallResultV16,
  RpcCallV16,
  TriggerMessageRequestV16,
} from "@cshil/ocpp-tools/types/v16";

interface OCPPRequest {
  type: OCPPMessageType;
  action: ActionV16;
  id: string;
  payload: OcppMessagePayloadV16;
  connectorId?: number | null;
}

class RequestHistory {
  private _currentId: string = "";
  private _requests: Map<string, OCPPRequest> = new Map();

  public add(request: OCPPRequest): void {
    this._currentId = request.id;
    this._requests.set(request.id, request);
  }

  public current(): OCPPRequest | undefined {
    return this._requests.get(this._currentId);
  }

  public get(id: string): OCPPRequest | undefined {
    return this._requests.get(id);
  }

  public remove(id: string): void {
    this._requests.delete(id);
  }
}

export class OCPPMessageHandler {
  private readonly _chargePoint: ChargePoint;
  private _webSocket: OCPPWebSocket;
  private _logger: Logger;
  private _requests: RequestHistory = new RequestHistory();

  constructor(
    chargePoint: ChargePoint,
    webSocket: OCPPWebSocket,
    logger: Logger,
  ) {
    this._chargePoint = chargePoint;
    this._webSocket = webSocket;
    this._logger = logger;

    this._webSocket.setMessageHandler(this.handleIncomingMessage.bind(this));
  }

  public authorize(tagId: string): void {
    this.sendRequest(
      new OCPPCallV16({
        messageId: crypto.randomUUID(),
        action: "Authorize",
        payload: {
          idTag: tagId,
        },
      }),
    );
  }

  public startTransaction(transaction: Transaction, connectorId: number): void {
    this.sendRequest(
      new OCPPCallV16({
        messageId: crypto.randomUUID(),
        action: "StartTransaction",
        payload: {
          connectorId: connectorId,
          idTag: transaction.tagId,
          meterStart: transaction.meterStart,
          timestamp: transaction.startTime.toISOString(),
        },
      }),
      connectorId,
    );
  }

  public stopTransaction(transaction: Transaction, connectorId: number): void {
    this.sendRequest(
      new OCPPCallV16({
        messageId: crypto.randomUUID(),
        action: "StopTransaction",
        payload: {
          transactionId: transaction.id!,
          idTag: transaction.tagId,
          meterStop: transaction.meterStop!,
          timestamp: transaction.stopTime!.toISOString(),
        },
      }),
      connectorId,
    );
  }

  public sendBootNotification(bootPayload: BootNotification): void {
    this.sendRequest(
      new OCPPCallV16({
        messageId: crypto.randomUUID(),
        action: "BootNotification",
        payload: {
          chargePointVendor: bootPayload.ChargePointVendor,
          chargePointModel: bootPayload.ChargePointModel,
          chargePointSerialNumber: bootPayload.ChargePointSerialNumber,
          chargeBoxSerialNumber: bootPayload.ChargeBoxSerialNumber,
          firmwareVersion: bootPayload.FirmwareVersion,
          iccid: bootPayload.Iccid,
          imsi: bootPayload.Imsi,
          meterType: bootPayload.MeterType,
          meterSerialNumber: bootPayload.MeterSerialNumber,
        },
      }),
    );
  }

  public sendHeartbeat(): void {
    this.sendRequest(
      new OCPPCallV16({
        messageId: crypto.randomUUID(),
        action: "Heartbeat",
        payload: {},
      }),
    );
  }

  public sendMeterValue(
    transactionId: number | undefined,
    connectorId: number,
    meterValue: number,
  ): void {
    this.sendRequest(
      new OCPPCallV16({
        messageId: crypto.randomUUID(),
        action: "MeterValues",
        payload: {
          transactionId: transactionId,
          connectorId: connectorId,
          meterValue: [
            {
              timestamp: new Date().toISOString(),
              sampledValue: [
                {
                  value: meterValue.toString(),
                },
              ],
            },
          ],
        },
      }),
    );
  }

  public sendStatusNotification(connectorId: number, status: OCPPStatus): void {
    this.sendRequest(
      new OCPPCallV16({
        messageId: crypto.randomUUID(),
        action: "StatusNotification",
        payload: {
          connectorId: connectorId,
          errorCode: "NoError",
          status: status,
        },
      }),
    );
  }

  private sendRequest(call: OCPPCallV16, connectorId?: number): void {
    this._requests.add({
      type: OCPPMessageType.CALL,
      action: call.action,
      id: call.messageId,
      payload: call.payload,
      connectorId,
    });
    this._webSocket.sendAction(call);
  }

  private handleIncomingMessage(message: unknown): void {
    this._logger.log(`Handling incoming message: ${message}`);
    if (isValidRpcCallV16(message)) {
      this.handleCall(message);
    } else if (isValidRpcCallResultV16(message)) {
      this.handleCallResult(message);
    } else if (isValidRpcCallErrorV16(message)) {
      this.handleCallError(message);
    } else {
      this._logger.error(`Unknown message: ${message}`);
    }
  }

  private handleCall(message: RpcCallV16): void {
    const messageId = message[1];
    const action = message[2];
    let response: OcppMessageResponsePayloadV16;
    if (isValidChangeAvailabilityRequestV16(message)) {
      response = this.handleChangeAvailability(message);
    } else if (isValidRemoteStartTransactionRequestV16(message)) {
      response = this.handleRemoteStartTransaction(message);
    } else if (isValidRemoteStopTransactionRequestV16(message)) {
      response = this.handleRemoteStopTransaction(message);
    } else if (isValidResetRequestV16(message)) {
      response = this.handleReset(message);
    } else if (isValidGetDiagnosticsRequestV16(message)) {
      response = this.handleGetDiagnostics(message);
    } else if (isValidTriggerMessageRequestV16(message)) {
      response = this.handleTriggerMessage(message);
    } else if (isValidGetConfigurationRequestV16(message)) {
      response = this.handleGetConfiguration(message);
    } else if (isValidChangeConfigurationRequestV16(message)) {
      response = this.handleChangeConfiguration(message);
    } else if (isValidClearCacheRequestV16(message)) {
      response = this.handleClearCache(message);
    } else if (isValidUnlockConnectorRequestV16(message)) {
      response = this.handleUnlockConnector(message);
    } else {
      this._logger.error(`Unsupported action: ${action}`);
      this._webSocket.sendError(
        new OCPPCallErrorV16({
          messageId,
          errorCode: OCPPErrorCodeV16.NotImplemented,
          errorDescription: "This action is not supported",
        }),
      );
      return;
    }
    this._webSocket.sendResult(
      new OCPPCallResultV16({
        messageId,
        payload: response,
      }),
    );
  }

  private handleCallResult(message: RpcCallResultV16): void {
    const messageId = message[1];
    if (!this._requests || !this._requests.get(messageId)) {
      this._logger.log(`Received unexpected CallResult: ${messageId}`);
      return;
    }
    const request = this._requests.get(messageId);
    if (isValidBootNotificationResponseV16(message)) {
      this.handleBootNotificationResponse(message);
    } else if (isValidAuthorizeResponseV16(message)) {
      this.handleAuthorizeResponse(message);
    } else if (isValidStartTransactionResponseV16(message)) {
      this.handleStartTransactionResponse(request?.connectorId ?? 1, message);
    } else if (isValidStopTransactionResponseV16(message)) {
      this.handleStopTransactionResponse(request?.connectorId ?? 1, message);
    } else if (isValidHeartbeatResponseV16(message)) {
      this.handleHeartbeatResponse(message);
    } else if (isValidMeterValuesResponseV16(message)) {
      this.handleMeterValuesResponse(
        message,
        request?.payload as MeterValuesRequestV16,
      );
    } else if (isValidStatusNotificationResponseV16(message)) {
      this.handleStatusNotificationResponse(message);
    } else if (isValidDataTransferResponseV16(message)) {
      this.handleDataTransferResponse(message);
    }

    this._requests.remove(messageId);
  }

  private handleCallError(message: RpcCallErrorV16): void {
    const messageId = message[1];
    this._logger.log(
      `Received error for message ${messageId}: ${JSON.stringify(message)}`,
    );
    // Handle the error appropriately
    this._requests.remove(messageId);
  }

  private handleRemoteStartTransaction(
    payload: RemoteStartTransactionRequestV16,
  ): RemoteStartTransactionResponseV16 {
    const { idTag, connectorId } = payload;
    const connector = this._chargePoint.getConnector(connectorId ?? 1);

    if (connector && connector.availability == "Operative") {
      this._chargePoint.startTransaction(idTag, connectorId || 1);
      return { status: "Accepted" };
    } else {
      return { status: "Rejected" };
    }
  }

  private handleRemoteStopTransaction(
    payload: RemoteStopTransactionRequestV16,
  ): RemoteStopTransactionResponseV16 {
    const { transactionId } = payload;
    const connector = Array.from(this._chargePoint.connectors.values()).find(
      (c) => c.transaction && c.transaction.id === transactionId,
    );

    if (connector) {
      this._chargePoint.updateConnectorStatus(
        connector.id,
        OCPPStatus.SuspendedEVSE,
      );
      this._chargePoint.stopTransaction(connector);
      return { status: "Accepted" };
    } else {
      return { status: "Rejected" };
    }
  }

  private handleReset(payload: ResetRequestV16): ResetResponseV16 {
    this._logger.log(`Reset request received: ${payload.type}`);
    setTimeout(() => {
      this._logger.log(`Reset chargePoint: ${this._chargePoint.id}`);
      if (payload.type === "Hard") {
        this._chargePoint.reset();
      } else {
        this._chargePoint.boot();
      }
    }, 5_000);
    return { status: "Accepted" };
  }

  private handleGetDiagnostics(
    payload: GetDiagnosticsRequestV16,
  ): GetDiagnosticsResponseV16 {
    this._logger.log(`Get diagnostics request received: ${payload.location}`); // e.g. `FTP
    const logs = this._logger.getLogs().join("\n");
    const blob = new Blob([logs], { type: "text/plain" });
    const file = new File([blob], "diagnostics.txt");
    (async () => await UploadFile(payload.location, file))();
    return { fileName: "diagnostics.txt" };
  }

  private handleGetConfiguration(
    payload: GetConfigurationRequestV16,
  ): GetConfigurationResponseV16 {
    this._logger.log(
      `Get configuration request received: ${JSON.stringify(payload.key)}`,
    );
    const configuration = OCPPMessageHandler.mapConfiguration(
      defaultConfiguration(this._chargePoint),
    );
    if (!payload.key || payload.key.length === 0) {
      return {
        configurationKey: configuration,
      };
    }
    const filteredConfig = configuration.filter((c) =>
      payload.key?.includes(c.key),
    );
    const configurationKeys = configuration.map((c) => c.key);
    const unknownKeys = payload.key.filter(
      (c) => !configurationKeys.includes(c),
    );
    return {
      configurationKey: filteredConfig,
      unknownKey: unknownKeys,
    };
  }

  private static mapConfiguration(
    config: Configuration,
  ): OcppConfigurationKey[] {
    return config.map((c) => ({
      key: c.key.name,
      readonly: c.key.readonly,
      value: OCPPMessageHandler.mapValue(c),
    }));
  }

  private static mapValue(value: ConfigurationValue): string {
    switch (value.key.type) {
      case "string":
        return (value as StringConfigurationValue).value;
      case "boolean":
        return String((value as BooleanConfigurationValue).value);
      case "integer":
        return String((value as IntegerConfigurationValue).value);
      case "array":
        return (value as ArrayConfigurationValue).value.join(",");
    }
  }

  private handleChangeConfiguration(
    payload: ChangeConfigurationRequestV16,
  ): ChangeConfigurationResponseV16 {
    this._logger.log(
      `Change configuration request received: ${JSON.stringify(payload.key)}: ${JSON.stringify(payload.value)}`,
    );
    switch (payload.key) {
      default:
        return {
          status: "NotSupported",
        };
    }
  }

  private handleTriggerMessage(
    payload: TriggerMessageRequestV16,
  ): TriggerMessageResponseV16 {
    this._logger.log(
      `Trigger message request received: ${payload.requestedMessage}`,
    ); // e.g. `DiagnosticsStatusNotification`
    return { status: "Accepted" };
  }

  private handleChangeAvailability(
    payload: ChangeAvailabilityRequestV16,
  ): ChangeAvailabilityResponseV16 {
    this._logger.log(
      `Change availability request received: ${JSON.stringify(payload)}`,
    );
    const updated = this._chargePoint.updateConnectorAvailability(
      payload.connectorId,
      payload.type,
    );
    if (updated) {
      return { status: "Accepted" };
    } else {
      return { status: "Rejected" };
    }
  }

  private handleClearCache(
    payload: ClearCacheRequestV16,
  ): ClearCacheResponseV16 {
    this._logger.log(
      `Clear cache request received: ${JSON.stringify(payload)}`,
    );
    return { status: "Accepted" };
  }

  private handleUnlockConnector(
    payload: UnlockConnectorRequestV16,
  ): UnlockConnectorResponseV16 {
    this._logger.log(
      `Unlock connector request received: ${JSON.stringify(payload)}`,
    );
    return { status: "NotSupported" };
  }

  private handleBootNotificationResponse(
    payload: BootNotificationResponseV16,
  ): void {
    this._logger.log("Boot notification successful");
    if (payload.status === "Accepted") {
      this._chargePoint.updateAllConnectorsStatus(OCPPStatus.Available);
      this._chargePoint.status = OCPPStatus.Available;
    } else {
      this._logger.error("Boot notification failed");
    }
  }

  private handleAuthorizeResponse(payload: AuthorizeResponseV16): void {
    const { idTagInfo } = payload;
    if (idTagInfo.status === "Accepted") {
      this._logger.log("Authorization successful");
    } else {
      this._logger.log("Authorization failed");
    }
  }

  private handleStartTransactionResponse(
    connectorId: number,
    payload: StartTransactionResponseV16,
  ): void {
    const { transactionId, idTagInfo } = payload;
    const connector = this._chargePoint.getConnector(connectorId);
    if (idTagInfo.status === "Accepted") {
      if (connector) {
        connector.transactionId = transactionId;
        connector.status = OCPPStatus.Charging;
      }
    } else {
      this._logger.log("Failed to start transaction");
      if (connector) {
        connector.status = OCPPStatus.Faulted;
        if (connector.transaction && connector.transaction.meterSent) {
          this._chargePoint.stopTransaction(connector);
        } else {
          this._chargePoint.cleanTransaction(connector);
        }
      } else {
        this._chargePoint.cleanTransaction(connectorId);
      }
      this._chargePoint.updateConnectorStatus(
        connectorId,
        OCPPStatus.Available,
      );
    }
  }

  private handleStopTransactionResponse(
    connectorId: number,
    payload: StopTransactionResponseV16,
  ): void {
    this._logger.log(
      `Transaction stopped successfully: ${JSON.stringify(payload)}`,
    );
    const connector = this._chargePoint.getConnector(connectorId);
    if (connector) {
      connector.transaction = null;
      connector.transactionId = null;
      connector.status = OCPPStatus.Available;
    }
  }

  private handleHeartbeatResponse(payload: HeartbeatResponseV16): void {
    this._logger.log(`Received heartbeat response: ${payload.currentTime}`);
  }

  private handleMeterValuesResponse(
    payload: MeterValuesResponseV16,
    request?: MeterValuesRequestV16,
  ): void {
    if (request) {
      const connector = this._chargePoint.getConnector(request.connectorId);
      if (connector && connector.transaction) {
        connector.transaction.meterSent = true;
      }
    }
    this._logger.log(
      `Meter values sent successfully: ${JSON.stringify(payload)}`,
    );
  }

  private handleStatusNotificationResponse(
    payload: StatusNotificationRequestV16,
  ): void {
    this._logger.log(
      `Status notification sent successfully: ${JSON.stringify(payload)}`,
    );
  }

  private handleDataTransferResponse(payload: DataTransferResponseV16): void {
    this._logger.log(
      `Data transfer sent successfully: ${JSON.stringify(payload)}`,
    );
  }
}
