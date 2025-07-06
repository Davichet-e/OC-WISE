export interface GlobalProcessConfig {
    // Node related
    eventNodeLabel: string;
    entityNodeLabel: string;
    activityProperty: string;
    entityFilterProperty: string;
    timestampProperty: string;

    // Relationship related
    dfBaseRelName: string;
    corrRelName: string;
    dfEntityRelName: string;

    // Attribute aggregation method
    aggregateByAttributeNodes: 'property' | 'node';
    // Only if aggregateByAttributeNodes === 'node'
    attributeRelLabel?: string;
    attributeNodeLabel?: string;
    attributeValueProperty?: string;
    attributeNameProperty?: string;

    // How is the DF type distinguished?
    dfTypeDistinction: 'label' | 'property';

    // Property on DF relationship indicating type (optional, only if dfTypeDistinction === 'property')
    dfTypePropertyName?: string;
}

export const initialGlobalProcessConfig: GlobalProcessConfig = {
    eventNodeLabel: 'Event',
    entityNodeLabel: 'Entity',
    activityProperty: 'type',
    entityFilterProperty: 'type',
    timestampProperty: 'time',
    dfBaseRelName: 'DF',
    corrRelName: 'CORR',
    dfEntityRelName: 'DF_ENTITY',
    aggregateByAttributeNodes: 'property',
    attributeRelLabel: undefined,
    attributeNodeLabel: undefined,
    attributeValueProperty: undefined,
    attributeNameProperty: undefined,
    dfTypeDistinction: 'label',
    dfTypePropertyName: undefined,
};