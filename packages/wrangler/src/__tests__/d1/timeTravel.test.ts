import { rest } from "msw";
import { describe, it } from "vitest";
import { throwIfDatabaseIsAlpha } from "../../d1/timeTravel/utils";
import { mockAccountId, mockApiToken } from "../helpers/mock-account-id";
import { mockConsoleMethods } from "../helpers/mock-console";
import { useMockIsTTY } from "../helpers/mock-istty";
import { mockGetMemberships, mockOAuthFlow } from "../helpers/mock-oauth-flow";
import { msw } from "../helpers/msw";
import { runInTempDir } from "../helpers/run-in-tmp";
import { runWrangler } from "../helpers/run-wrangler";
import writeWranglerToml from "../helpers/write-wrangler-toml";

describe("time-travel", () => {
	mockConsoleMethods();
	mockAccountId({ accountId: null });
	mockApiToken();
	runInTempDir();
	const { mockOAuthServerCallback } = mockOAuthFlow();
	const { setIsTTY } = useMockIsTTY();

	describe("restore", () => {
		it("should reject the use of --timestamp with --bookmark", async ({
			expect,
		}) => {
			setIsTTY(false);
			writeWranglerToml({
				d1_databases: [
					{ binding: "DATABASE", database_name: "db", database_id: "xxxx" },
				],
			});

			await expect(
				runWrangler(
					"d1 time-travel restore db --timestamp=1234 --bookmark=5678"
				)
			).rejects.toThrowError(
				`Provide either a timestamp, or a bookmark - not both.`
			);
		});
	});

	describe("throwIfDatabaseIsAlpha", () => {
		it("should throw for alpha dbs", async ({ expect }) => {
			writeWranglerToml({
				d1_databases: [
					{ binding: "DATABASE", database_name: "db", database_id: "xxxx" },
				],
			});
			mockOAuthServerCallback();
			mockGetMemberships([
				{ id: "IG-88", account: { id: "1701", name: "enterprise" } },
			]);
			msw.use(
				rest.get(
					"*/accounts/:accountId/d1/database/*",
					async (_req, res, ctx) => {
						return res(
							ctx.status(200),
							ctx.json({
								result: {
									uuid: "d5b1d127-xxxx-xxxx-xxxx-cbc69f0a9e06",
									name: "northwind",
									created_at: "2023-05-23T08:33:54.590Z",
									version: "alpha",
									num_tables: 13,
									file_size: 33067008,
									running_in_region: "WEUR",
								},
								success: true,
								errors: [],
								messages: [],
							})
						);
					}
				)
			);
			await expect(
				throwIfDatabaseIsAlpha("1701", "d5b1d127-xxxx-xxxx-xxxx-cbc69f0a9e06")
			).rejects.toThrowError(
				"Time travel is not available for alpha D1 databases. You will need to migrate to a new database for access to this feature."
			);
		});
		it("should not throw for non-alpha dbs", async ({ expect }) => {
			writeWranglerToml({
				d1_databases: [
					{ binding: "DATABASE", database_name: "db", database_id: "xxxx" },
				],
			});
			mockOAuthServerCallback();
			mockGetMemberships([
				{ id: "IG-88", account: { id: "1701", name: "enterprise" } },
			]);
			msw.use(
				rest.get(
					"*/accounts/:accountId/d1/database/*",
					async (_req, res, ctx) => {
						return res(
							ctx.status(200),
							ctx.json({
								result: {
									uuid: "d5b1d127-xxxx-xxxx-xxxx-cbc69f0a9e06",
									name: "northwind",
									created_at: "2023-05-23T08:33:54.590Z",
									version: "production",
									num_tables: 13,
									file_size: 33067008,
									running_in_region: "WEUR",
								},
								success: true,
								errors: [],
								messages: [],
							})
						);
					}
				)
			);
			const result = await throwIfDatabaseIsAlpha(
				"1701",
				"d5b1d127-xxxx-xxxx-xxxx-cbc69f0a9e06"
			);
			//since the function throws if the db is alpha
			expect(result).toBeUndefined();
		});
	});
});
