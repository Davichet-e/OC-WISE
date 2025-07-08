import React, { useState, useMemo } from "react";
import { CreatedNorm } from "./App";


interface NormsTableProps {
    norms: CreatedNorm[];
}

const NORM_TYPE_LABELS: Record<string, string> = {
    AverageTimeBetweenActivitiesNorm: "Avg Time Between Activities",
    EntityFollowsEntityNorm: "Entity Follows Entity",
    EventToEntityRelationshipNorm: "Event-to-Entity Relationship",
    ActivityDirectlyFollowsNorm: "Activity Directly Follows",
    EventPropertyValueNorm: "Event Property Value",
    EntityPropertyValueNorm: "Entity Property Value",
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

    const getPropertyDetails = (norm: CreatedNorm) => {
        switch (norm.norm_type) {
            case 'AverageTimeBetweenActivitiesNorm':
                return `A: "${norm.activity_a}" → B: "${norm.activity_b}"`;
            case 'EntityFollowsEntityNorm':
                return `A: "${norm.entity_type_a}" → B: "${norm.entity_type_b}"`;
            case 'EventToEntityRelationshipNorm':
                return `Obj: "${norm.context_entity_type}" ← Evt: "${norm.target_activity}" (${norm.operator} ${norm.count})`;
            case 'ActivityDirectlyFollowsNorm':
                return `A: "${norm.activity_a}" → B: "${norm.activity_b}" (${norm.forbidden ? 'Forbidden' : 'Allowed'})`;
            case 'EventPropertyValueNorm':
            case 'EntityPropertyValueNorm':
                const value = Array.isArray(norm.value) ? `[${norm.value.join(', ')}]` : `"${norm.value}"`;
                return `${norm.target_name}.${norm.property_name} ${norm.operator} ${value}`;
            default:
                return 'N/A';
        }
    }


    return (
        <div className="dark:text-gray-200 text-gray-800">
            <div className="flex flex-wrap gap-2 mb-3">
                <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="px-2 py-1 border rounded text-sm bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                >
                    <option value="all">All Norm Types</option>
                    {Object.entries(NORM_TYPE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                    ))}
                </select>
                <input
                    type="text"
                    placeholder="Search by ID or description..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="px-2 py-1 border rounded text-sm flex-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 placeholder-gray-400"
                />
            </div>
            <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                <table className="min-w-full text-xs bg-white dark:bg-gray-800">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-3 py-2 text-left font-semibold">Type</th>
                            <th className="px-3 py-2 text-left font-semibold">Details</th>
                            <th className="px-3 py-2 text-left font-semibold">Description</th>
                            <th className="px-3 py-2 text-left font-semibold">Weight</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredNorms.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="text-center py-4 text-gray-500 dark:text-gray-400">
                                    No norms found. Add one from the panel on the left.
                                </td>
                            </tr>
                        ) : (
                            filteredNorms.map((norm, idx) => (
                                <tr key={norm.norm_id || idx} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                                    <td className="px-3 py-2 whitespace-nowrap"><span className="font-medium">{NORM_TYPE_LABELS[norm.norm_type] || norm.norm_type}</span><br /><span className="text-gray-500">{norm.norm_id}</span></td>
                                    <td className="px-3 py-2 font-mono">{getPropertyDetails(norm)}</td>
                                    <td className="px-3 py-2">{norm.description}</td>
                                    <td className="px-3 py-2 text-center">{norm.weight?.toFixed(1) ?? ""}</td>
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