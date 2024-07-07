import React, {useState, useEffect} from "react";
import OCPPChargePoint from "../utils/ocpp_chargepoint";
import * as ocpp from "../utils/ocpp_constants";
import Connector from "./Connector.tsx";
import {useLocation} from "react-router-dom";
import Logger from "./Logger.tsx";

const ChargePoint: React.FC = () => {
  const [cpStatus, setCpStatus] = useState<string>(ocpp.OCPPStatus.Unavailable);
  const [cp, setCp] = useState<OCPPChargePoint | null>(null);
  const [tagID, setTagID] = useState<string>("");

  const [isHeartbeatEnabled, setIsHeartbeatEnabled] = useState<boolean>(false);

  const search = useLocation().search;
  const query = new URLSearchParams(search);

  useEffect(() => {
    const connectorNumber = parseInt(query.get("connectors") || localStorage.getItem("CONNECTORS") || "2");
    const wsURL = query.get("wsurl") || localStorage.getItem("WSURL") || "";
    const cpID = query.get("cpid") || localStorage.getItem("CPID") || "CP-001";
    const tagID = query.get("tag") || localStorage.getItem("TAG") || "DEADBEEF";

    localStorage.setItem("WSURL", wsURL);
    localStorage.setItem("CONNECTORS", connectorNumber.toString());
    localStorage.setItem("CPID", cpID);
    localStorage.setItem("TAG", tagID);

    const newCp = new OCPPChargePoint(connectorNumber, wsURL, cpID);

    newCp.setStatusChangeCallback(statusChangeCb);
    newCp.setLoggingCallback(logMsg);
    setCp(newCp);
  }, []);

  useEffect(() => {
    setTagID(localStorage.getItem("TAG") || "");
  }, []);

  const statusChangeCb = (s: string, msg?: string) => {
    setCpStatus(s);
    if (msg) logMsg(msg);
  };

  const logMsg = (msg: string) => {
    console.log(msg);
  };

  const handleConnect = () => {
    if (cp) {
      cp.wsConnect();
    }
  };

  const handleDisconnect = () => {
    if (cp) {
      cp.wsDisconnect();
    }
  };

  const handleAuthorize = () => {
    if (cp) {
      const tagId = localStorage.getItem("TAG") || "DEADBEEF";
      cp.authorize(tagId);
    }
  };

  const handleHeartbeat = () => {
    if (cp) {
      cp.sendHeartbeat();
    }
  };

  const handleHeartbeatInterval = (isEnalbe:boolean) => {
    setIsHeartbeatEnabled(isEnalbe);
    if (cp) {
      if(isEnalbe){
        cp.startHeartbeat(10);
      }else{
        cp.stopHeartbeat();
      }
    }
  }

  return (
    <div className="bg-white shadow-md rounded px-2 pt-2 pb-1 h-screen">
      <Settings/>
      <div className="flex flex-col md:flex-row">
        <div className="bg-gray-100 rounded p-4 mr-4">
          <div className="bg-gray-100 rounded p-4 mr-4">
            <CPStatus status={cpStatus}/>
          </div>
          <button
            onClick={handleConnect}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-2 w-full
            disabled:bg-blue-300
            "
            disabled={cpStatus !== ocpp.OCPPStatus.Unavailable}
          >
            Connect
          </button>
          <button
            onClick={handleDisconnect}
            className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded mb-2 w-full
            disabled:bg-red-300
            "
            disabled={cpStatus === ocpp.OCPPStatus.Unavailable}
          >
            Disconnect
          </button>
          <div className="bg-gray-100 rounded p-4">
            <button
              onClick={handleHeartbeat}
              className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded mb-2 w-full
            disabled:bg-purple-300
            "
              disabled={cpStatus === ocpp.OCPPStatus.Unavailable}
            >
              Heartbeat
            </button>
            <div className="flex items-center">
              <button
                className={`bg-${isHeartbeatEnabled ? "red" : "green"}-500 hover:bg-${isHeartbeatEnabled ? "red" : "green"}-700 text-white font-bold py-2 px-4 rounded mb-2 w-full`}
                onClick={() => handleHeartbeatInterval(!isHeartbeatEnabled)}
              >
                {isHeartbeatEnabled ? "Disable" : "Enable"} Heartbeat
              </button>
            </div>
          </div>
        </div>
        <div className="flex-1">
          <div className="bg-gray-100 rounded p-4">
            <div className="mb-6">
              <label
                className="block text-gray-700 text-sm font-bold mb-2"
                htmlFor="TAG"
              >RFID Tag
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="TAG"
                type="text"
                value={tagID}
                onChange={(e) => setTagID(e.target.value)}
                placeholder="DEADBEEF"
                style={{maxWidth: "20ch"}}
              />
              <p className="text-gray-600 text-xs italic mt-1">
                The ID of the simulated RFID tag
              </p>
            </div>
            <button
              onClick={handleAuthorize}
              className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded w-full
              disabled:bg-green-300
              "
              disabled={cpStatus !== ocpp.OCPPStatus.Available}
            >
              Authorize
            </button>
          </div>
          <div className="flex flex-col md:flex-row mt-4">
            {
              cp?.connectorNumber && Array.from(Array(cp.connectorNumber).keys()).map((i) => (
                <Connector key={i + 1} id={i + 1} cp={cp}/>
              ))
            }
          </div>
        </div>
      </div>
      <Logger/>
    </div>
  );
};

const CPStatus: React.FC<{ status: string }> = ({status}) => {
  const statusColor = (s: string) => {
    switch (s) {
      case ocpp.OCPPStatus.Unavailable:
        return "text-black";
      case ocpp.OCPPStatus.Available:
        return "text-green-500";
      case ocpp.OCPPStatus.Charging:
        return "text-blue-500";
      default:
        return "text-red-500";
    }
  }
  return (
    <div className="bg-gray-100 rounded p-4 mr-4 border border-gray-400">
      <label className="block text-lg font-semibold">CP Status</label>
      <p className="text-2xl font-bold text-center">
        <span className={statusColor(status)}>{status}</span>
      </p>
    </div>
  )
    ;
}

const Settings: React.FC = () => {
  const [wsURL, setWsURL] = useState<string>(localStorage.getItem("WSURL") || "");
  const [connectorNumber, setConnectorNumber] = useState<number>(parseInt(localStorage.getItem("CONNECTORS") || "2"));
  const [cpID, setCpID] = useState<string>(localStorage.getItem("CPID") || "CP-001");
  const [ocppVersion, setOcppVersion] = useState < string > (localStorage.getItem("OCPP") || "OCPP-1.6J");
  return (
    <div className="mb-1 bg-gray-100 rounded p-2">
      <p className="text-lg font-semibold">settings</p>
      <li>WSURL: {wsURL}</li>
      <li>CONNECTORS: {connectorNumber}</li>
      <li>CPID: {cpID}</li>
      <li>OCPP: {ocppVersion}</li>
    </div>
  );
}

export default ChargePoint;
