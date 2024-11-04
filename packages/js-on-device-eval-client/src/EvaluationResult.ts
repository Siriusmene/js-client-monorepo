import {
  DynamicConfigEvaluation,
  GateEvaluation,
  LayerEvaluation,
  SecondaryExposure,
  Spec,
} from '@statsig/client-core';

export type EvaluationResult = {
  readonly unsupported: boolean;
  readonly bool_value: boolean;
  readonly rule_id: string;
  readonly secondary_exposures: SecondaryExposure[];
  readonly json_value: Record<string, unknown>;
  readonly explicit_parameters: string[] | null;
  readonly allocated_experiment_name: string | null;
  readonly undelegated_secondary_exposures: SecondaryExposure[] | undefined;
  readonly is_experiment_group: boolean;
  readonly group_name: string | null;
};

export function makeEvalResult(
  overrides: Partial<EvaluationResult>,
): EvaluationResult {
  const base: EvaluationResult = {
    unsupported: false,
    bool_value: false,
    rule_id: '',
    secondary_exposures: [],
    json_value: {},
    explicit_parameters: null,
    allocated_experiment_name: null,
    is_experiment_group: false,
    group_name: null,
    undelegated_secondary_exposures: undefined,
  };

  return { ...base, ...overrides };
}

export function resultToGateEval(
  spec: Spec,
  result: EvaluationResult,
): GateEvaluation {
  return {
    name: spec.name,
    id_type: spec.idType,
    rule_id: result.rule_id,
    value: result.bool_value,
    secondary_exposures: result.secondary_exposures,
    version: spec.version?.toString(),
  };
}

export function resultToConfigEval(
  spec: Spec,
  result: EvaluationResult,
): DynamicConfigEvaluation {
  return {
    name: spec.name,
    id_type: spec.idType,
    rule_id: result.rule_id,
    value: result.json_value,
    secondary_exposures: result.secondary_exposures,
    group: result.group_name ?? '',
    group_name: result.group_name ?? undefined,
    is_device_based: false,
    is_experiment_active: spec.isActive,
    is_user_in_experiment: result.is_experiment_group,
    version: spec.version?.toString(),
    passed: result.bool_value,
  };
}

export function resultToLayerEval(
  layerSpec: Spec,
  experimentSpec: Spec | null,
  result: EvaluationResult,
): LayerEvaluation {
  return {
    name: layerSpec.name,
    rule_id: result.rule_id,
    value: result.json_value,
    secondary_exposures: result.secondary_exposures,
    undelegated_secondary_exposures: result.undelegated_secondary_exposures,
    allocated_experiment_name: result.allocated_experiment_name ?? '',
    explicit_parameters: result.explicit_parameters ?? [],
    group: result.group_name ?? '',
    group_name: result.group_name ?? undefined,
    is_device_based: false,
    is_experiment_active: experimentSpec?.isActive,
    is_user_in_experiment: result.is_experiment_group,
    version: layerSpec.version?.toString(),
  };
}
