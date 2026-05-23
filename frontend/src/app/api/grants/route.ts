import { type NextRequest, NextResponse } from "next/server";
import { getDependencies } from "@/server/grant-ops/dependencies";
export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
	try {
		const deps = getDependencies();
		const grants = await deps.repository.getGrants();

		// Get sort parameter from query string, default to 'fit'
		const { searchParams } = new URL(request.url);
		const sortBy = searchParams.get("sortBy") || "fit";

		// Sort grants based on sortBy parameter
		const sortedGrants = [...grants].sort((a, b) => {
			switch (sortBy) {
				case "fit":
					// Fit descending (higher fit first)
					return (b.fit || 0) - (a.fit || 0);
				case "deadline":
					// Deadline soonest first, Rolling last
					if (a.deadline === "Rolling") return 1;
					if (b.deadline === "Rolling") return -1;
					return (a.daysOut || 999) - (b.daysOut || 999);
				case "award":
					// Award amount descending (higher amount first)
					return (b.awardSort || 0) - (a.awardSort || 0);
				default:
					// Default to fit descending
					return (b.fit || 0) - (a.fit || 0);
			}
		});

		return NextResponse.json(sortedGrants);
	} catch (error) {
		console.error("Error getting grants:", error);
		return NextResponse.json(
			{ error: "Failed to get grants" },
			{ status: 500 },
		);
	}
}
