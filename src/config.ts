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

    // Attribute Storage
    attributeStorage: 'property' | 'node';
    // Only if attributeStorage === 'node'
    attributeRelName?: string;
    attributeNodeLabel?: string;
    attributeNameProperty?: string;
    attributeValueProperty?: string;

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
    attributeStorage: 'property',
    attributeRelName: 'HAS_ATTRIBUTE',
    attributeNodeLabel: 'Attribute',
    attributeNameProperty: 'name',
    attributeValueProperty: 'value',
    dfTypeDistinction: 'label',
    dfTypePropertyName: undefined,
};
