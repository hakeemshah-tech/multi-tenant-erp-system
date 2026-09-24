import { Router } from "express";
import { AUDIT_DB_TABLE, ch } from "@/audit/clickhouse";
import { logView } from "@/audit/logger";
import EmployeeModel from "@/database/models/employee.model";
import { Types } from "mongoose";
import { authenticate } from "@/common/middlewares/authMiddleware";
import { EmployeeProfile } from "@/database/models/employeeProfile.model";

const router = Router();

// Pages endpoint removed - now using static list in frontend

/**
 * GET /audit/events
 * Query params:
 *   tenantId, branchId, userId, aggregateType, aggregateId, op, pathLike, from, to, limit (default 100)
 *   actor_name (case-insensitive substring search)
 *   pages (comma-separated list of pages)
 *   page (page number, default 1)
 *   count (boolean, whether to return total count)
 */
router.get("/events", async (req, res) => {
  try {
    // First, let's test if the table exists and has any data
    try {
      const testQuery = `SELECT COUNT(*) as total FROM ${AUDIT_DB_TABLE}`;
      const testResult = await ch.query({ query: testQuery });
      console.log("Table test query result:", testResult);
    } catch (testError) {
      console.error("Table test failed:", testError);
    }

    const {
      tenantId,
      branchId,
      userId,
      aggregateType,
      aggregateId,
      op,
      pathLike,
      from,
      to,
      limit = "100",
      actor_name, // 👈 NEW
      subject_name, // 👈 NEW - filter by subject user name
      pages, // 👈 NEW - comma-separated list of pages
      page = "1", // 👈 NEW - page number
      count = "false", // 👈 NEW - whether to return total count
    } = req.query as Record<string, string | undefined>;

    const where: string[] = [];
    const params: Record<string, any> = {};

    if (tenantId) {
      where.push("tenant_id = {tenantId:String}");
      params.tenantId = tenantId;
    }
    if (branchId) {
      where.push("branch_id = {branchId:String}");
      params.branchId = branchId;
    }
    if (userId) {
      where.push("user_id = {userId:String}");
      params.userId = userId;
    }
    if (aggregateType) {
      where.push("aggregate_type = {aggregateType:String}");
      params.aggregateType = aggregateType;
    }
    if (aggregateId) {
      where.push("aggregate_id = {aggregateId:String}");
      params.aggregateId = aggregateId;
    }
    if (op) {
      where.push(
        "op = {op:Enum8('insert' = 1, 'update' = 2, 'replace' = 3, 'delete' = 4, 'custom' = 5, 'view' = 6, 'login' = 7, 'register' = 8, 'logout' = 9, 'register-tenant' = 10, 'register-employee' = 11, 'invitation-sent' = 12, 'invitation-accepted' = 13, 'field-change-requested' = 14, 'field-change-approved' = 15, 'field-change-rejected' = 16, 'document-uploaded' = 17, 'document-approved' = 18, 'document-rejected' = 19, 'document-expired' = 20)}"
      );
      params.op = op;
    }
    if (from) {
      console.log("Date filter FROM:", from);
      // Validate ISO date format
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/.test(from)) {
        console.error("Invalid FROM date format:", from);
        return res.status(400).json({
          success: false,
          message:
            "Invalid FROM date format. Expected ISO 8601 format (e.g., 2025-10-03T18:09:00.000Z)",
        });
      }
      where.push("ts >= toDateTime64({from:String}, 3, 'UTC')");
      params.from = from;
    }
    if (to) {
      console.log("Date filter TO:", to);
      // Validate ISO date format
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/.test(to)) {
        console.error("Invalid TO date format:", to);
        return res.status(400).json({
          success: false,
          message:
            "Invalid TO date format. Expected ISO 8601 format (e.g., 2025-10-03T18:09:00.000Z)",
        });
      }
      where.push("ts <= toDateTime64({to:String}, 3, 'UTC')");
      params.to = to;
    }
    if (pathLike) {
      // index over changed_paths
      where.push("hasAny(changed_paths, [ {pathLike:String} ])");
      params.pathLike = pathLike;
    }
    if (actor_name) {
      // case-insensitive substring on Nullable(String)
      where.push(
        "positionCaseInsensitiveUTF8(ifNull(actor_name, ''), {actor_name:String}) > 0"
      );
      params.actor_name = actor_name;
      // If you ALSO want to match the raw 'actor' field, use this instead:
      // where.push("(positionCaseInsensitiveUTF8(ifNull(actor_name,''), {actor_name:String}) > 0 OR positionCaseInsensitiveUTF8(ifNull(actor,''), {actor_name:String}) > 0)");
    }
    if (subject_name) {
      // case-insensitive substring on subject user name
      where.push(
        "positionCaseInsensitiveUTF8(ifNull(subject_user_name, ''), {subject_name:String}) > 0"
      );
      params.subject_name = subject_name;
    }
    if (pages) {
      // Filter by pages - split comma-separated list and create IN clause
      const pageList = pages
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      if (pageList.length > 0) {
        const pagePlaceholders = pageList
          .map((_, i) => `{page${i}:String}`)
          .join(", ");
        where.push(
          `JSONExtractString(meta_json, 'page') IN (${pagePlaceholders})`
        );
        pageList.forEach((page, i) => {
          params[`page${i}`] = page;
        });
      }
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const lim = Math.min(parseInt(String(limit) || "100", 10), 1000);
    const pageNum = Math.max(parseInt(String(page) || "1", 10), 1);
    const offset = (pageNum - 1) * lim;
    const shouldCount = count === "true";

    // Get total count if requested
    let totalCount = 0;
    if (shouldCount) {
      try {
        const countQuery = `
          SELECT COUNT(*) as total
          FROM ${AUDIT_DB_TABLE}
          ${whereSql}
        `;
        console.log("Count query:", countQuery);
        console.log("Count query params:", params);

        const countResult = await ch.query({
          query: countQuery,
          query_params: params,
        });
        console.log("Count query result type:", typeof countResult);
        console.log("Count query result keys:", Object.keys(countResult || {}));
        console.log(
          "Count query result has data:",
          "data" in (countResult || {})
        );
        console.log(
          "Count query result has json:",
          "json" in (countResult || {})
        );

        try {
          // Handle different possible result structures for count
          if (countResult && typeof countResult === "object") {
            if (Array.isArray(countResult)) {
              totalCount = countResult[0]?.total || 0;
              console.log("Count: result is array, total:", totalCount);
            } else if (countResult.data && Array.isArray(countResult.data)) {
              totalCount = countResult.data[0]?.total || 0;
              console.log("Count: result.data is array, total:", totalCount);
            } else if (
              countResult.json &&
              typeof countResult.json === "function"
            ) {
              console.log("Count: calling result.json()");
              const jsonResult = await countResult.json();
              console.log(
                "Count: json result type:",
                typeof jsonResult,
                "isArray:",
                Array.isArray(jsonResult)
              );
              totalCount = Array.isArray(jsonResult)
                ? jsonResult[0]?.total || 0
                : 0;
            } else {
              console.log("Count: unknown result structure");
            }
          }
        } catch (countError) {
          console.error("Error processing count result:", countError);
          totalCount = 0;
        }
      } catch (countQueryError) {
        console.error("Error executing count query:", countQueryError);
        totalCount = 0;
      }
    }

    const query = `
      SELECT
        event_id,
        concat(replaceOne(toString(ts), ' ', 'T'), 'Z') AS ts,
        tenant_id, branch_id, user_id, actor, actor_name,
        subject_user_id, subject_user_name,
        aggregate_type, aggregate_id, op, path, source,
        diff_json, meta_json
      FROM ${AUDIT_DB_TABLE}
      ${whereSql}
      ORDER BY ts DESC
      LIMIT ${lim} OFFSET ${offset}
    `;

    console.log("Events query:", query);
    console.log("Events query params:", params);

    let result;
    try {
      result = await ch.query({
        query,
        format: "JSONEachRow",
        query_params: params,
      });
    } catch (queryError) {
      console.error("Error executing events query:", queryError);
      console.error("Query that failed:", query);
      console.error("Params that failed:", params);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch audit events",
        error: queryError.message,
      });
    }

    console.log("Events query result type:", typeof result);
    console.log("Events query result keys:", Object.keys(result || {}));
    console.log("Events query result has data:", "data" in (result || {}));
    console.log("Events query result has json:", "json" in (result || {}));

    let data = [];
    try {
      // Handle different possible result structures for events
      if (result && typeof result === "object") {
        if (Array.isArray(result)) {
          data = result;
        } else if (result.data && Array.isArray(result.data)) {
          data = result.data;
        } else if (result.json && typeof result.json === "function") {
          const jsonResult = await result.json();
          data = Array.isArray(jsonResult) ? jsonResult : [];
        }
      }
    } catch (dataError) {
      console.error("Error processing events result:", dataError);
      data = [];
    }

    // Fallback: if count failed but we have data, estimate total
    if (shouldCount && totalCount === 0 && data.length > 0) {
      // If we got a full page, there might be more data
      if (data.length === lim) {
        totalCount = pageNum * lim + 1; // At least one more page
      } else {
        totalCount = (pageNum - 1) * lim + data.length; // Exact count
      }
      console.log("Using fallback total count:", totalCount);
    }

    const hasNext =
      data.length === lim &&
      pageNum * lim < (shouldCount ? totalCount : Number.MAX_SAFE_INTEGER);
    const hasPrev = pageNum > 1;

    res.json({
      success: true,
      data,
      pagination: {
        page: pageNum,
        limit: lim,
        total: shouldCount ? totalCount : null,
        hasNext,
        hasPrev,
        totalPages: shouldCount ? Math.ceil(totalCount / lim) : null,
      },
      // For backward compatibility
      total: shouldCount ? totalCount : null,
      hasNext,
      hasPrev,
    });
  } catch (e: any) {
    console.error("audit list error", e);
    res.status(500).json({ message: "Failed to fetch audit events" });
  }
});

/**
 * POST /audit/view-employee-section/:branchId
 * Body: { sectionKey: string, innerSectionKey?: string }
 * Auth: requires req.user with { userId, email, assignments: [{ tenantId, branchId, ... }] }
 */
router.post(
  "/view-employee-section/:branchId",
  authenticate,
  async (req, res, next) => {
    try {
      // --- branch param validation
      const branchParam = String(req.params.branchId || "").trim();
      if (!Types.ObjectId.isValid(branchParam)) {
        return res.status(400).json({ message: "Invalid branch id" });
      }
      const branchIdParam = new Types.ObjectId(branchParam);

      // --- auth & membership validation (like getMyOrganizationById)
      const user = (req as any).user;
      const rawUserId = user?.userId ?? user?._id; // support either shape
      if (!rawUserId) return res.status(401).json({ message: "Unauthorized" });

      const userId = new Types.ObjectId(String(rawUserId));
      const assignments = (user?.assignments || []) as Array<{
        tenantId: string | Types.ObjectId;
        branchId: string | Types.ObjectId;
        role?: string;
      }>;

      const matched = assignments.find(
        (a) => String(a.branchId) === String(branchIdParam)
      );
      if (!matched) {
        return res.status(403).json({
          message:
            "Forbidden: you are not assigned to this organisation (branch).",
        });
      }

      const tenantId = new Types.ObjectId(String(matched.tenantId));

      // --- resolve employeeId for this user+tenant+branch
      // prefer a verified employee id if present on req.user, else look up by userId/tenantId/branchId
      let employeeId: Types.ObjectId | null = null;

      if (userId) {
        const found = await EmployeeProfile.findOne({
          userId,
        })
          .select("_id")
          .lean();

        if (!found?._id) {
          return res.status(404).json({
            message: "Employee record not found for this branch.",
          });
        }
        employeeId = found._id as Types.ObjectId;
      }

      // --- body validation
      const { sectionKey, innerSectionKey } = req.body || {};
      if (!sectionKey || typeof sectionKey !== "string") {
        return res.status(400).json({ message: "sectionKey is required" });
      }

      // --- find the employee doc for current user in this branch
      const employee = await EmployeeModel.findOne({
        employeeProfile: employeeId,
        tenantId,
        branchId: branchIdParam,
      });
      if (!employee) {
        return res
          .status(404)
          .json({ message: "Employee not found for this branch" });
      }

      const subjectUserId = String(employee.employeeProfile);
      const subjectUserName = String(
        (employee.employeeFields?.personaldetails?.firstname || "") +
          " " +
          (employee.employeeFields?.personaldetails?.lastname || "")
      ).trim();

      await logView({
        tenantId: employee.tenantId,
        branchId: employee.branchId,
        subjectUserId,
        subjectUserName,
        aggregateType: "Employee",
        aggregateId: employee._id,
        sectionKey,
        innerSectionKey: innerSectionKey ?? null,

        // Optional decorations
        path: sectionKey,
        source: req.originalUrl,
        audit: {
          actorUserId: userId,
          actorEmail: user?.email,
          actorName: user?.fullName, // Actor's actual name
          route: (req as any).route?.path,
          method: req.method,
          ip: req.ip,
          ua: req.headers["user-agent"] as string | undefined,
          page: req.headers["x-page"] as string | undefined,
        },
      });

      // tracking endpoint → no content needed
      return res.status(204).end();
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Employer views an employee's section by EmployeeModel _id
 * POST /view-employer-employee-section/:employeeId
 *
 * Require:
 *  - req.user.activeAssignment.tenantId
 *  - req.user.activeAssignment.branchId
 * Body:
 *  - { sectionKey: string, innerSectionKey?: string }
 */
router.post(
  "/view-employer-employee-section/:employeeId",
  authenticate,
  async (req, res, next) => {
    try {
      // --- validate employeeId param
      const employeeParam = String(req.params.employeeId || "").trim();
      if (!Types.ObjectId.isValid(employeeParam)) {
        return res.status(400).json({ message: "Invalid employee id" });
      }
      const employeeIdParam = new Types.ObjectId(employeeParam);

      // --- ensure active assignment available
      const user: any = (req as any).user;
      const rawUserId = user?.userId ?? user?._id;
      if (!rawUserId) return res.status(401).json({ message: "Unauthorized" });

      const active = user?.activeAssignment;
      if (!active?.tenantId || !active?.branchId) {
        return res
          .status(401)
          .json({ message: "Unauthorized: no active organisation context" });
      }

      const tenantId = new Types.ObjectId(String(active.tenantId));
      const branchId = new Types.ObjectId(String(active.branchId));
      const actorUserId = new Types.ObjectId(String(rawUserId));

      // --- body validation
      const { sectionKey, innerSectionKey } = req.body || {};
      if (!sectionKey || typeof sectionKey !== "string") {
        return res.status(400).json({ message: "sectionKey is required" });
      }

      // --- verify employee exists AND belongs to employer's tenant+branch
      // First, try exact match (best path)
      let employee = await EmployeeModel.findOne({
        _id: employeeIdParam,
        tenantId,
        branchId,
      }).lean();

      if (!employee) {
        // Optional: disambiguate for clearer errors
        const existsElsewhere = await EmployeeModel.exists({
          _id: employeeIdParam,
        });
        if (existsElsewhere) {
          return res.status(403).json({
            message:
              "Forbidden: employee does not belong to your active branch/tenant.",
          });
        }
        return res.status(404).json({ message: "Employee not found" });
      }

      const subjectUserId = String(employee.employeeProfile);
      const subjectUserName = user?.fullName;
      //  String(
      //   (employee.employeeFields?.personaldetails?.firstname || "") +
      //     " " +
      //     (employee.employeeFields?.personaldetails?.lastname || "")
      // ).trim();

      await logView({
        tenantId: employee.tenantId,
        branchId: employee.branchId,
        subjectUserId,
        subjectUserName,
        aggregateType: "Employee",
        aggregateId: employee._id,
        sectionKey,
        innerSectionKey: innerSectionKey ?? null,
        // Optional decorations
        path: sectionKey,
        source: req.originalUrl,
        audit: {
          actorUserId,
          actorEmail: user?.email,
          actorName: user?.fullName, // Actor's actual name
          route: (req as any).route?.path,
          method: req.method,
          ip: req.ip,
          ua: req.headers["user-agent"] as string | undefined,
          page: req.headers["x-page"] as string | undefined,
        },
        summary: `Viewed ${sectionKey} of ${
          employee.employeeFields?.personaldetails?.firstname || ""
        } ${employee.employeeFields?.personaldetails?.lastname || ""}`,
      });

      // tracking endpoint → no content needed
      return res.status(204).end();
    } catch (err) {
      next(err);
    }
  }
);

export default router;
