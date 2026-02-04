# Copyright (c) 2025, Frappe Technologies and contributors
# For license information, please see license.txt

"""MCP debug APIs for MCP Management page: list FAC tools and prompts (Inspector-style)."""

import json

import frappe


@frappe.whitelist()
def get_mcp_debug_tools():
	"""
	Return FAC tools available to the current user (for MCP Management debug).
	Requires Raven Settings read. Returns empty list if FAC not installed or not enabled.
	"""
	frappe.has_permission(doctype="Raven Settings", ptype="read", throw=True)
	if "frappe_assistant_core" not in frappe.get_installed_apps():
		return {"tools": [], "error": "frappe_assistant_core not installed"}

	settings = frappe.get_single("Raven Settings")
	if not getattr(settings, "enable_fac_integration", False):
		return {"tools": [], "error": "FAC integration not enabled in Raven Settings"}

	try:
		from frappe_assistant_core.api.in_process import list_tools_for_session_user

		res = list_tools_for_session_user()
		return {"tools": res.get("tools") or []}
	except Exception as e:
		frappe.log_error(
			title="MCP Debug: list FAC tools",
			message=frappe.get_traceback(),
		)
		return {"tools": [], "error": str(e)}


@frappe.whitelist()
def get_mcp_debug_prompts():
	"""
	Return FAC prompts available to the current user (for MCP Management debug).
	Requires Raven Settings read. Returns empty list if FAC not installed.
	"""
	frappe.has_permission(doctype="Raven Settings", ptype="read", throw=True)
	if "frappe_assistant_core" not in frappe.get_installed_apps():
		return {"prompts": [], "error": "frappe_assistant_core not installed"}

	try:
		from frappe_assistant_core.api.handlers.prompts import handle_prompts_list

		response = handle_prompts_list(request_id=None)
		prompts = (response.get("result") or {}).get("prompts") or []
		return {"prompts": prompts}
	except Exception as e:
		frappe.log_error(
			title="MCP Debug: list FAC prompts",
			message=frappe.get_traceback(),
		)
		return {"prompts": [], "error": str(e)}


@frappe.whitelist()
def call_mcp_debug_tool(tool_name: str, arguments: str = "{}"):
	"""
	Execute a FAC tool in-process for the current user (MCP Inspector-style Run Tool).
	Requires Raven Settings read. arguments must be a JSON string (e.g. '{"doctype": "Customer", "limit": 10}').
	"""
	frappe.has_permission(doctype="Raven Settings", ptype="read", throw=True)
	if not tool_name or not isinstance(tool_name, str):
		return {"ok": False, "error": "tool_name is required"}

	if "frappe_assistant_core" not in frappe.get_installed_apps():
		return {"ok": False, "error": "frappe_assistant_core not installed"}

	settings = frappe.get_single("Raven Settings")
	if not getattr(settings, "enable_fac_integration", False):
		return {"ok": False, "error": "FAC integration not enabled in Raven Settings"}

	try:
		args = json.loads(arguments) if isinstance(arguments, str) else (arguments or {})
	except (TypeError, ValueError) as e:
		return {"ok": False, "error": f"Invalid arguments JSON: {e}"}

	def _json_default(obj):
		import datetime
		if isinstance(obj, (datetime.datetime, datetime.date, datetime.time)):
			return obj.isoformat()
		raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")

	try:
		from frappe_assistant_core.api.in_process import call_tool_in_process

		result = call_tool_in_process(tool_name, args)
		# Ensure JSON-serializable for frontend (FAC may return datetime etc.)
		if isinstance(result, (dict, list)):
			return {"ok": True, "result": json.loads(json.dumps(result, default=_json_default))}
		return {"ok": True, "result": str(result)}
	except Exception as e:
		frappe.log_error(
			title="MCP Debug: call FAC tool",
			message=frappe.get_traceback(),
		)
		return {"ok": False, "error": str(e)}
