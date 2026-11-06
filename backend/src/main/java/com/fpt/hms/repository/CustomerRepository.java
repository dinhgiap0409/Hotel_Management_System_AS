successfully downloaded text file (SHA: 5420511fb3c38c8a5384296e6436117e13a1579a)package com.fpt.hms.repository;

import com.fpt.hms.entity.Customer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CustomerRepository extends JpaRepository<Customer, Integer> {
    Optional<Customer> findByAccount_AccountId(Integer accountId);
    Optional<Customer> findByEmailIgnoreCase(String email);
    boolean existsByIdentityNumberIgnoreCase(String identityNumber);
    boolean existsByIdentityNumberIgnoreCaseAndCustomerIdNot(String identityNumber, Integer customerId);
}
