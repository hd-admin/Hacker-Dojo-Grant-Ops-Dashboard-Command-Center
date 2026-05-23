"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { seedGrants } from "../../../shared/seed-data";
import type { Grant, GrantStatus } from "../../../shared/types";
import { client } from "../lib/grant-ops-client";

type ViewType =
	| "dashboard"
	| "discovery"
	| "pipeline"
	| "settings"
	| "notifications"
	| "tasks";

interface PipelineViewProps {
	onGrantSelect: (grantId: string) => void;
	onNavigate?: (view: ViewType) => void;
}

type StatusFilter =
	| "All"
	| "Matched"
	| "Drafting"
	| "Review"
	| "Submitted"
	| "Awarded";

interface BoardColumn {
	key: GrantStatus | "awarded";
	title: string;
}

const columns: BoardColumn[] = [
	{ key: "matched", title: "Matched" },
	{ key: "draft", title: "Drafting" },
	{ key: "review", title: "Review" },
	{ key: "submitted", title: "Submitted" },
	{ key: "awarded", title: "Awarded/Closed" },
];

function formatDate(dateStr: string): string {
	if (dateStr === "Rolling") return "Rolling";
	const parts = dateStr.split("-");
	const month = parts[1] ?? "";
	const day = parts[2] ?? "";
	const months = [
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec",
	];
	return `${months[parseInt(month, 10) - 1] ?? ""} ${parseInt(day, 10)}`;
}

export default function PipelineView({
	onGrantSelect,
	onNavigate,
}: PipelineViewProps) {
	const [grants, setGrants] = useState<Grant[]>(seedGrants);
	const [loading, setLoading] = useState(false);
	const [draggingGrantId, setDraggingGrantId] = useState<string | null>(null);
	const [dragOverCol, setDragOverCol] = useState<string | null>(null);
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");

	useEffect(() => {
		async function load() {
			try {
				const data = await client.grants.getAll();
				setGrants(data);
			} catch (error) {
				console.error("Error loading grants:", error);
				setGrants([]);
			} finally {
				setLoading(false);
			}
		}
		load();
	}, []);

	if (loading) {
		return <div className="header-title">Loading...</div>;
	}

	const getGrantsForColumn = (status: GrantStatus | "awarded") => {
		if (statusFilter !== "All") {
			// When filtered, only show grants matching the filter in their respective column
			const filterStatusMap: Record<StatusFilter, GrantStatus | "awarded"> = {
				All: "matched",
				Matched: "matched",
				Drafting: "draft",
				Review: "review",
				Submitted: "submitted",
				Awarded: "awarded",
			};
			const targetStatus = filterStatusMap[statusFilter];
			if (status !== targetStatus) {
				return []; // Hide this column when filtered to a different status
			}
			return grants.filter((g) => g.status === targetStatus);
		}
		if (status === "awarded") {
			return grants.filter((g) => g.status === "awarded");
		}
		return grants.filter((g) => g.status === status);
	};

	const handleDragStart = (grantId: string) => {
		setDraggingGrantId(grantId);
	};

	const handleDragOver = (e: React.DragEvent, colKey: string) => {
		e.preventDefault();
		setDragOverCol(colKey);
	};

	const handleDragLeave = () => {
		setDragOverCol(null);
	};

	const handleDrop = async (
		e: React.DragEvent,
		colKey: GrantStatus | "awarded",
	) => {
		e.preventDefault();
		setDragOverCol(null);
		if (draggingGrantId) {
			const statusLabelMap: Record<GrantStatus, string> = {
				matched: "Matched",
				draft: "Drafting",
				review: "Review",
				submitted: "Submitted",
				awarded: "Awarded",
			};
			try {
				await client.grants.updateStatus(
					draggingGrantId,
					colKey as GrantStatus,
					statusLabelMap[colKey as GrantStatus],
				);
				setGrants((prev) =>
					prev.map((g) =>
						g.id === draggingGrantId
							? { ...g, status: colKey as GrantStatus }
							: g,
					),
				);
			} catch (error) {
				console.error("Error updating grant status:", error);
			}
			setDraggingGrantId(null);
		}
	};

	const handleDragEnd = () => {
		setDraggingGrantId(null);
		setDragOverCol(null);
	};

	return (
		<>
			<div className="header">
				<div>
					<h1 className="header-title">
						Pipeline <span className="accent">Grant board</span>
					</h1>
					<div className="header-sub">
						{grants.filter((g) => g.status !== "awarded").length} active grants
					</div>
				</div>
				<div className="header-actions">
					<select
						className="filter-select"
						value={statusFilter}
						onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
					>
						<option value="All">Filter: All</option>
						<option value="Matched">Matched</option>
						<option value="Drafting">Drafting</option>
						<option value="Review">Review</option>
						<option value="Submitted">Submitted</option>
						<option value="Awarded">Awarded</option>
					</select>
					<button
						type="button"
						className="btn btn-primary"
						onClick={() => onNavigate?.("discovery")}
					>
						+ Add to pipeline
					</button>
				</div>
			</div>

			{/* Board */}
			<div className="board">
				{columns.map((col) => {
					const colGrants = getGrantsForColumn(col.key);
					return (
						<section
							key={col.key}
							aria-label={`${col.title} drop zone`}
							className={`board-col ${dragOverCol === col.key ? "drag-over" : ""}`}
							onDragOver={(e) => handleDragOver(e, col.key)}
							onDragLeave={handleDragLeave}
							onDrop={(e) => handleDrop(e, col.key)}
						>
							<div className="board-col-header">
								<div className="board-col-title">{col.title.toUpperCase()}</div>
								<div className="board-col-count">{colGrants.length}</div>
							</div>
							<div className="board-col-body">
								{colGrants.length === 0 ? (
									<div className="empty">none</div>
								) : (
									colGrants.map((grant) => (
										<button
											type="button"
											key={grant.id}
											className={`board-card ${draggingGrantId === grant.id ? "dragging" : ""}`}
											draggable={true}
											onDragStart={() => handleDragStart(grant.id)}
											onDragEnd={handleDragEnd}
											onClick={() => onGrantSelect(grant.id)}
										>
											<div className="board-card-funder">
												{grant.funderShort}
											</div>
											<div className="board-card-title">{grant.title}</div>
											<div className="board-card-foot">
												<span>{formatDate(grant.deadline)}</span>
												<span className="amount">{grant.award}</span>
											</div>
										</button>
									))
								)}
							</div>
						</section>
					);
				})}
			</div>
		</>
	);
}
