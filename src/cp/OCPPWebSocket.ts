import { Logger } from "./Logger";
import {
  AuthorizeRequestV16,
  BootNotificationRequestV16,
  ChangeAvailabilityResponseV16,
  ChangeConfigurationResponseV16,
  GetConfigurationResponseV16,
  GetDiagnosticsResponseV16,
  HeartbeatRequestV16,
  MeterValuesRequestV16,
  OCPPCallErrorV16,
  OCPPCallResultV16,
  OCPPCallV16,
  RemoteStartTransactionResponseV16,
  RemoteStopTransactionResponseV16,
  ResetResponseV16,
  StartTransactionRequestV16,
  StatusNotificationRequestV16,
  StopTransactionRequestV16,
  TriggerMessageResponseV16,
  UnlockConnectorResponseV16,
} from "@cshil/ocpp-tools";
import { OCPPErrorCodeV16 } from "@cshil/ocpp-tools/types";

export type OcppMessagePayloadV16 =
  | OCPPRequestTypeV16
  | OcppMessageResponsePayloadV16
  | OcppMessageErrorPayloadV16;

export type OCPPRequestTypeV16 =
  | AuthorizeRequestV16
  | BootNotificationRequestV16
  | HeartbeatRequestV16
  | MeterValuesRequestV16
  | StartTransactionRequestV16
  | StatusNotificationRequestV16
  | StopTransactionRequestV16;

export type OcppMessageResponsePayloadV16 =
  | ChangeAvailabilityResponseV16
  | ChangeConfigurationResponseV16
  | GetConfigurationResponseV16
  | GetDiagnosticsResponseV16
  | RemoteStartTransactionResponseV16
  | RemoteStopTransactionResponseV16
  | ResetResponseV16
  | TriggerMessageResponseV16
  | UnlockConnectorResponseV16;

export type OcppMessageErrorPayloadV16 = {
  readonly errorCode: OCPPErrorCodeV16;
  readonly errorDescription: string;
  readonly errorDetails?: object;
};

type MessageHandler = (message: unknown) => void;

export class OCPPWebSocket {
  private _ws: WebSocket | null = null;
  private _url: string;
  private _basicAuth: { username: string; password: string } | null = null;
  private _chargePointId: string;
  private _logger: Logger;
  private _messageHandler: MessageHandler | null = null;
  private _pingInterval: number | null = null;
  private _reconnectAttempts: number = 0;
  private _maxReconnectAttempts: number = 5;
  private _reconnectDelay: number = 5000; // 5 seconds

  constructor(
    url: string,
    chargePointId: string,
    logger: Logger,
    basicAuthSettings: { username: string; password: string } | null = null,
  ) {
    this._url = url;
    this._chargePointId = chargePointId;
    this._logger = logger;
    if (basicAuthSettings) {
      this._basicAuth = {
        username: basicAuthSettings.username,
        password: basicAuthSettings.password,
      };
    }
  }

  get url(): string {
    return this._url;
  }

  public connect(
    onopen: (() => void) | null = null,
    onclose: ((ev: CloseEvent) => void) | null = null,
  ): void {
    const url = new URL(this._url);
    if (this?._basicAuth) {
      url.username = this._basicAuth.username;
      url.password = this._basicAuth.password;
    }
    console.log("url", url);
    this._ws = new WebSocket(`${url.toString()}${this._chargePointId}`, [
      "ocpp1.6",
      "ocpp1.5",
    ]);
    this._ws.onopen = () => {
      if (onopen) {
        onopen();
      }
      this.handleOpen.bind(this);
    };
    this._ws.onmessage = this.handleMessage.bind(this);
    this._ws.onerror = this.handleError.bind(this);
    this._ws.onclose = (ev: CloseEvent) => {
      if (onclose) {
        onclose(ev);
      }
      this.handleClose.bind(this);
    };
  }

  public disconnect(): void {
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
    if (this._pingInterval) {
      clearInterval(this._pingInterval);
      this._pingInterval = null;
    }
  }

  public sendAction(call: OCPPCallV16): void {
    this.send(JSON.stringify(call.toRPCObject()));
  }

  public sendResult(result: OCPPCallResultV16): void {
    const message = JSON.stringify(result.toRPCObject());
    this.send(message);
  }

  public sendError(error: OCPPCallErrorV16): void {
    const message = JSON.stringify(error.toRPCObject());
    this.send(message);
  }

  private send(message: string): void {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(message);
      this._logger.log(`Sent: ${message}`);
    } else {
      this._logger.log("WebSocket is not connected");
    }
  }

  public setMessageHandler(handler: MessageHandler): void {
    this._messageHandler = handler;
  }

  private handleOpen(): void {
    this._logger.log("WebSocket connected");
    this._reconnectAttempts = 0;

    // this.startPingInterval();
  }

  private handleMessage(ev: MessageEvent): void {
    this._logger.log(`Received: ${JSON.stringify(ev)}`);
    try {
      if (this._messageHandler) {
        this._messageHandler(JSON.parse(ev.data.toString()));
      } else {
        this._logger.log("No message handler set");
      }
    } catch (error) {
      this._logger.log(`Error parsing message: ${error}`);
    }
  }

  private handleError(evt: Event): void {
    this._logger.log(`WebSocket error type: ${evt.type}`);
  }

  private handleClose(msg: MessageEvent): void {
    this._logger.log(`WebSocket closed: ${msg}`);
    this.stopPingInterval();
    this.attemptReconnect();
  }

  // private startPingInterval(): void {
  //   this._pingInterval = setInterval(() => {
  //     if (this._ws && this._ws.readyState === WebSocket.OPEN) {
  //       this._ws.ping();
  //     }
  //   }, 30000); // Send a ping every 30 seconds
  // }

  private stopPingInterval(): void {
    if (this._pingInterval) {
      clearInterval(this._pingInterval);
      this._pingInterval = null;
    }
  }

  private attemptReconnect(): void {
    if (this._reconnectAttempts < this._maxReconnectAttempts) {
      this._reconnectAttempts++;
      this._logger.log(
        `Attempting to reconnect (${this._reconnectAttempts}/${this._maxReconnectAttempts})...`,
      );
      setTimeout(() => this.connect(), this._reconnectDelay);
    } else {
      this._logger.log(
        "Max reconnect attempts reached. Please check your connection and try again.",
      );
    }
  }
}
