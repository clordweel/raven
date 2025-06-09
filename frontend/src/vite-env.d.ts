/// <reference types="vite/client" />

interface Window {
    frappe: {
        boot: {
            __messages: Record<string, string>;
        };
    };
}