import React, { useState, useMemo } from "react";
import { CreatedNorm } from "./App";


interface NormsTableProps {
    norms: CreatedNorm[];
}

const NORM_TYPE_LABELS: Record<string, string> = {
    AverageTimeBetweenActivitiesNorm: "Avg Time Between Activities",
    ObjectFollowsObjectNorm: "Object Follows Object",
    ActivityFrequencyNorm: "Activity Frequency",
    ActivityDirectlyFollowsNorm: "Activity Directly Follows",
};

export const NormsTable: React.FC<NormsTableProps> = ({ norms }) => {
    const [filter, setFilter] = useState<string>("all");
    const [search, setSearch] = useState<string>("");

    const filteredNorms = useMemo(() => {
        return norms.filter((norm) => {
            const matchesType = filter === "all" || norm.norm_type === filter;
            const matchesSearch =
                !search ||
                norm.norm_id?.toLowerCase().includes(search.toLowerCase()) ||
                norm.description?.toLowerCase().includes(search.toLowerCase());
            return matchesType && matchesSearch;
        });
    }, [norms, filter, search]);

    return (
        <div>
            <div className="flex flex-wrap gap-2 mb-3">
                <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="px-2 py-1 border rounded text-sm"
                >
                    <option value="all">All Norm Types</option>
                    {Object.entries(NORM_TYPE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                    ))}
                </select>
                <input
                    type="text"
                    placeholder="Search by ID or description"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="px-2 py-1 border rounded text-sm flex-1"
                />
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded">
                    <thead>
                        <tr className="bg-gray-100 dark:bg-gray-700">
                            <th className="px-2 py-2 border-b">Type</th>
                            <th className="px-2 py-2 border-b">ID</th>
                            <th className="px-2 py-2 border-b">Description</th>
                            <th className="px-2 py-2 border-b">Weight</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredNorms.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="text-center py-4 text-gray-500 dark:text-gray-400">
                                    No norms found.
                                </td>
                            </tr>
                        ) : (
                            filteredNorms.map((norm, idx) => (
                                <tr key={norm.norm_id || idx} className="border-t">
                                    <td className="px-2 py-2">{NORM_TYPE_LABELS[norm.norm_type] || norm.norm_type}</td>
                                    <td className="px-2 py-2">{norm.norm_id}</td>
                                    <td className="px-2 py-2">{norm.description}</td>
                                    <td className="px-2 py-2">{norm.weight ?? ""}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default NormsTable;