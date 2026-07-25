import {
  MOCK_APPOINTMENTS,
  MOCK_DIAGNOSTICS,
  MOCK_IDENTIFIED_PRODUCTS,
  MOCK_SERVICE_REQUESTS,
  MOCK_WARRANTIES,
} from "../data/mock-support";
import type {
  DiagnosticCase,
  IdentifiedProduct,
  ServiceAppointment,
  ServiceRequest,
  Warranty,
} from "../types/support";

export interface SupportRepository {
  findIdentifiedProducts(
    signal?: AbortSignal,
  ): Promise<readonly IdentifiedProduct[]>;
  findDiagnostics(
    signal?: AbortSignal,
  ): Promise<readonly DiagnosticCase[]>;
  findWarranties(signal?: AbortSignal): Promise<readonly Warranty[]>;
  findServiceRequests(
    signal?: AbortSignal,
  ): Promise<readonly ServiceRequest[]>;
  findAppointments(
    signal?: AbortSignal,
  ): Promise<readonly ServiceAppointment[]>;
}

export class SupportServiceError extends Error {
  readonly code: "not-found" | "request-cancelled";

  constructor(code: SupportServiceError["code"], message: string) {
    super(message);
    this.name = "SupportServiceError";
    this.code = code;
  }
}

const assertNotAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) {
    throw new SupportServiceError(
      "request-cancelled",
      "La consulta de soporte fue cancelada.",
    );
  }
};

export class MockSupportRepository implements SupportRepository {
  async findIdentifiedProducts(
    signal?: AbortSignal,
  ): Promise<readonly IdentifiedProduct[]> {
    assertNotAborted(signal);
    return Promise.resolve(MOCK_IDENTIFIED_PRODUCTS);
  }

  async findDiagnostics(
    signal?: AbortSignal,
  ): Promise<readonly DiagnosticCase[]> {
    assertNotAborted(signal);
    return Promise.resolve(MOCK_DIAGNOSTICS);
  }

  async findWarranties(
    signal?: AbortSignal,
  ): Promise<readonly Warranty[]> {
    assertNotAborted(signal);
    return Promise.resolve(MOCK_WARRANTIES);
  }

  async findServiceRequests(
    signal?: AbortSignal,
  ): Promise<readonly ServiceRequest[]> {
    assertNotAborted(signal);
    return Promise.resolve(MOCK_SERVICE_REQUESTS);
  }

  async findAppointments(
    signal?: AbortSignal,
  ): Promise<readonly ServiceAppointment[]> {
    assertNotAborted(signal);
    return Promise.resolve(MOCK_APPOINTMENTS);
  }
}

export class SupportService {
  constructor(private readonly repository: SupportRepository) {}

  async listIdentifiedProducts(
    signal?: AbortSignal,
  ): Promise<readonly IdentifiedProduct[]> {
    return this.repository.findIdentifiedProducts(signal);
  }

  async getDiagnostic(
    diagnosticId: string,
    signal?: AbortSignal,
  ): Promise<DiagnosticCase | undefined> {
    const diagnostics = await this.repository.findDiagnostics(signal);
    assertNotAborted(signal);
    return diagnostics.find(
      (diagnostic) => diagnostic.id === diagnosticId,
    );
  }

  async getWarranty(
    warrantyId: string,
    signal?: AbortSignal,
  ): Promise<Warranty | undefined> {
    const warranties = await this.repository.findWarranties(signal);
    assertNotAborted(signal);
    return warranties.find((warranty) => warranty.id === warrantyId);
  }

  async getServiceRequest(
    requestId: string,
    signal?: AbortSignal,
  ): Promise<ServiceRequest | undefined> {
    const requests = await this.repository.findServiceRequests(signal);
    assertNotAborted(signal);
    return requests.find((request) => request.id === requestId);
  }

  async getAppointmentForRequest(
    requestId: string,
    signal?: AbortSignal,
  ): Promise<ServiceAppointment | undefined> {
    const appointments = await this.repository.findAppointments(signal);
    assertNotAborted(signal);
    return appointments.find(
      (appointment) => appointment.requestId === requestId,
    );
  }

  async listRequests(
    signal?: AbortSignal,
  ): Promise<readonly ServiceRequest[]> {
    return this.repository.findServiceRequests(signal);
  }
}

export const supportService = new SupportService(
  new MockSupportRepository(),
);

