import React from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles.css";

export const startInstance = {};

const root = document.getElementById("root");
if (!root) throw new Error("Elemento root não encontrado");

createRoot(root).render(React.createElement(RouterProvider, { router: getRouter() }));
